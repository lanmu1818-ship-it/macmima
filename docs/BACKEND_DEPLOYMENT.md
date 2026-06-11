# 后端部署教程

本文说明如何把 MacMima 后端部署到自己的 Linux 服务器。

示例命令以 Ubuntu/Debian 为主，域名、路径、数据库密码请替换为自己的值。

## 1. 部署架构

推荐结构：

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

后端进程建议只监听 `127.0.0.1`，由反向代理对外提供 HTTPS。

## 2. 准备服务器

安装基础工具：

```bash
sudo apt update
sudo apt install -y curl git build-essential
```

安装 Node.js 20 和 pnpm：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
corepack prepare pnpm@9 --activate
```

安装 MySQL：

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
```

## 3. 创建数据库和低权限用户

进入 MySQL：

```bash
sudo mysql
```

执行：

```sql
CREATE DATABASE macmima CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'macmima'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
ON macmima.* TO 'macmima'@'localhost';
FLUSH PRIVILEGES;
```

不要在生产环境使用 MySQL `root` 账号作为应用连接账号。

## 4. 准备代码

```bash
sudo mkdir -p /opt/macmima-server
sudo chown -R "$USER":"$USER" /opt/macmima-server
cd /opt/macmima-server
git clone <your-repository-url> .
cd server
pnpm install --frozen-lockfile
```

## 5. 配置环境变量

复制示例文件：

```bash
cp .env.example .env
```

编辑 `.env`：

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

生成随机密钥：

```bash
openssl rand -base64 32
```

分别为 `JWT_SECRET` 和 `AUTH_PEPPER` 生成不同值。`AUTH_PEPPER` 只能放在服务器环境里，
不要写进数据库、文档或 Git。

## 6. 初始化数据库

当前开源版本可使用 Prisma `db push` 初始化表结构：

```bash
npx prisma generate
npx prisma db push
```

生产项目成熟后，建议改为 Prisma migrations：

```bash
npx prisma migrate deploy
```

## 7. 构建并启动

```bash
pnpm build
pnpm start
```

健康检查：

```bash
curl http://127.0.0.1:3000/health
```

返回示例：

```json
{"status":"ok","timestamp":"2026-06-12T00:00:00.000Z"}
```

## 8. 使用 PM2 守护进程

```bash
sudo npm install -g pm2
pm2 start dist/index.js --name macmima-api
pm2 save
pm2 startup
```

查看状态：

```bash
pm2 status
pm2 logs macmima-api
```

## 9. 配置 HTTPS

### Caddy 推荐方式

Caddy 可以自动申请和续期 Let's Encrypt 证书。

安装 Caddy 后创建 Caddyfile：

```caddyfile
api.example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

重载：

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

APP 中填写：

```text
https://api.example.com/api
```

### Nginx 方式

使用 Nginx 时可以配合 Certbot 申请免费 HTTPS 证书。

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

## 10. 升级后端

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

如果项目已切换到 migrations，则把 `db push` 换成：

```bash
npx prisma migrate deploy
```

## 11. 备份建议

至少备份：

- MySQL 数据库
- 服务器 `.env`
- 反向代理配置

数据库备份示例：

```bash
mysqldump -u macmima -p macmima > macmima-$(date +%F).sql
```

注意：数据库里保存的是密文，但仍然属于敏感资产。备份文件也应加密保存。

## 12. 安全检查清单

- 后端只监听 `127.0.0.1`。
- MySQL 只允许本机连接。
- 使用独立低权限数据库用户。
- `JWT_SECRET` 和 `AUTH_PEPPER` 是长随机值。
- `.env` 不提交到 Git。
- 反向代理启用 HTTPS。
- 定期更新依赖并检查 `pnpm audit --prod`。

