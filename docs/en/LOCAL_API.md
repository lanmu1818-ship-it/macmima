# Local API

The MacMima desktop app can expose a Local API so trusted local tools can save credentials
into MacMima.

The Local API listens only on `127.0.0.1`. The default port is `37621`. The actual port
and Local API Key can be viewed and changed in the app's personal settings.

## Enable

1. Open MacMima.
2. Log in and unlock the vault.
3. Open personal settings.
4. Enable Local API.
5. Generate or copy the Local API Key.
6. Copy the request URL.

Example request URL:

```text
http://127.0.0.1:37621/v1/credentials
```

## Health Check

```bash
curl http://127.0.0.1:37621/health
```

Example:

```json
{
  "ok": true,
  "enabled": true
}
```

## Authentication

Use one of the following methods.

Authorization Bearer:

```http
Authorization: Bearer <LOCAL_API_KEY>
```

Custom header:

```http
X-MacMima-Local-Api-Key: <LOCAL_API_KEY>
```

## Create A Database Credential

```bash
curl -X POST http://127.0.0.1:37621/v1/credentials \
  -H "Authorization: Bearer <LOCAL_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "database",
    "scope": "personal",
    "title": "Local MySQL",
    "databaseType": "mysql",
    "host": "127.0.0.1",
    "port": "3306",
    "database": "app_db",
    "username": "app_user",
    "password": "replace-with-password",
    "tables": [
      {
        "name": "users",
        "description": "System user table"
      },
      {
        "name": "credentials",
        "description": "Credential ciphertext and sync metadata"
      }
    ],
    "tags": ["local", "mysql"]
  }'
```

`scope` can be:

- `personal`
- `shared`, requires Shared Vault permission

## Create An API Key Credential

```bash
curl -X POST http://127.0.0.1:37621/v1/credentials \
  -H "X-MacMima-Local-Api-Key: <LOCAL_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "api_key",
    "scope": "personal",
    "title": "Model Provider API Key",
    "service": "Model Provider",
    "apiKey": "replace-with-api-key",
    "apiSecret": "replace-with-api-secret",
    "tags": ["ai", "model"]
  }'
```

## Fields

Common fields:

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | Credential title |
| `category` | string | `server`, `website`, `api_key`, `database`, `other` |
| `scope` | string | `personal` or `shared` |
| `tags` | string[] | Tags |
| `data` | object | Custom data object |

Common direct fields:

| Field | Description |
| --- | --- |
| `host` | Server or database host |
| `port` | Port |
| `database` | Database name |
| `username` | Username |
| `password` | Password |
| `connectionString` | Connection string |
| `url` | Website URL |
| `email` | Login email |
| `apiKey` | API Key |
| `apiSecret` | API Secret |
| `accessKeyId` | Access Key ID |
| `accessKeySecret` | Access Key Secret |
| `tables` | Database table names and descriptions |
| `databaseTables` | Database table names and descriptions |
| `tableRelations` | Database table names and descriptions |

## Response

Success:

```json
{
  "ok": true,
  "credential": {
    "id": "credential-id",
    "title": "Local MySQL",
    "category": "database"
  }
}
```

Common errors:

| Status | Meaning |
| --- | --- |
| `401` | Local API Key is incorrect |
| `404` | Endpoint does not exist |
| `423` | MacMima is not open or not unlocked |
| `504` | Frontend save timeout |

## Security Notes

- Local API payloads are passed to the unlocked desktop app and encrypted before being saved.
- The backend database stores ciphertext, IV, auth tag, and metadata. It should not contain
  plaintext credentials pushed through the Local API.
- Give the Local API Key only to trusted local tools.
- Do not commit the Local API Key.
- Disable the Local API when not needed.
- Confirm team visibility before pushing to the Shared Vault.
