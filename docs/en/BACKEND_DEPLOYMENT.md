# Backend Deployment

This guide explains how to deploy the MacMima backend on your own Linux server.

Examples target Ubuntu/Debian. Replace domains, paths, database names, and passwords with
your own values.

## 1. Recommended Architecture

```text
MacMima Desktop App
        |
        | HTTPS
        v
Reverse Proxy, Caddy or Nginx
        |
        | http://127.0.0.1:3000
        v
MacMima API, Express + Prisma
        |
        v
MySQL 8
```

The backend process should bind to `127.0.0.1`. A reverse proxy should expose HTTPS to users.

## 2. Prepare The Server

```bash
sudo apt update
sudo apt install -y curl git build-essential
```

Install Node.js 20 and pnpm:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
corepack prepare pnpm@9 --activate
```

Install MySQL:

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
```

## 3. Create Database And Low-Privilege User

```bash
sudo mysql
```

```sql
CREATE DATABASE macmima CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'macmima'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
ON macmima.* TO 'macmima'@'localhost';
FLUSH PRIVILEGES;
```

Do not use the MySQL `root` account as the application database user in production.

## 4. Prepare Source Code

```bash
sudo mkdir -p /opt/macmima-server
sudo chown -R "$USER":"$USER" /opt/macmima-server
cd /opt/macmima-server
git clone <your-repository-url> .
cd server
pnpm install --frozen-lockfile
```

## 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="mysql://macmima:replace-with-a-strong-password@localhost:3306/macmima"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="30d"
JWT_REFRESH_EXPIRES_IN="90d"
AUTH_PEPPER="replace-with-a-different-long-random-secret"
AUTH_ARGON2_MEMORY_KIB=19456
AUTH_ARGON2_TIME_COST=2
AUTH_ARGON2_PARALLELISM=1
HOST="127.0.0.1"
PORT=3000
NODE_ENV="production"
ALLOWED_ORIGINS="app://macmima,http://localhost:5173"
```

Generate random values:

```bash
openssl rand -base64 32
```

Use different values for `JWT_SECRET` and `AUTH_PEPPER`. Store `AUTH_PEPPER` only in the
server environment. Do not commit it, store it in the database, or paste it into docs.

## 6. Initialize Database

The current open-source version can initialize tables with Prisma `db push`:

```bash
npx prisma generate
npx prisma db push
```

For mature production deployments, prefer migrations:

```bash
npx prisma migrate deploy
```

## 7. Build And Start

```bash
pnpm build
pnpm start
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Example response:

```json
{"status":"ok","timestamp":"2026-06-12T00:00:00.000Z"}
```

## 8. Run With PM2

```bash
sudo npm install -g pm2
pm2 start dist/index.js --name macmima-api
pm2 save
pm2 startup
```

Check status:

```bash
pm2 status
pm2 logs macmima-api
```

## 9. HTTPS

### Caddy

Caddy can automatically issue and renew Let's Encrypt certificates.

```caddyfile
api.example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

Reload:

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

Use this in the app:

```text
https://api.example.com/api
```

### Nginx

Nginx can be used with Certbot for free HTTPS certificates.

```nginx
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 10. Upgrade

```bash
cd /opt/macmima-server
git pull
cd server
pnpm install --frozen-lockfile
npx prisma generate
npx prisma db push
pnpm build
pm2 restart macmima-api
```

If using migrations, replace `db push` with:

```bash
npx prisma migrate deploy
```

## 11. Backup

Back up at least:

- MySQL database
- Server `.env`
- Reverse proxy configuration

Example:

```bash
mysqldump -u macmima -p macmima > macmima-$(date +%F).sql
```

The database stores ciphertext, not plaintext credential bodies, but backups are still
sensitive assets and should be encrypted.

## 12. Security Checklist

- Backend binds to `127.0.0.1`.
- MySQL allows only local connections.
- A dedicated low-privilege database user is used.
- `JWT_SECRET` and `AUTH_PEPPER` are long random values.
- `.env` is never committed.
- HTTPS is enabled at the reverse proxy.
- Request bodies are not logged.
- `pnpm audit --prod` is checked regularly.
