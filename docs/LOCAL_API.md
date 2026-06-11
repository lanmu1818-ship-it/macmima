# 本地 API 接入

MacMima 桌面端可以开启本地 API，让其他本机工具把凭证写入 MacMima。

本地 API 只监听 `127.0.0.1`，默认端口为 `37621`。实际端口和 API Key
可以在 APP 的个人设置中查看和修改。

## 开启流程

1. 打开 MacMima APP。
2. 登录并解锁密区。
3. 进入个人设置。
4. 开启本地 API。
5. 生成或复制 Local API Key。
6. 复制请求地址。

请求地址示例：

```text
http://127.0.0.1:37621/v1/credentials
```

## 健康检查

```bash
curl http://127.0.0.1:37621/health
```

返回示例：

```json
{
  "ok": true,
  "enabled": true
}
```

## 认证方式

支持两种方式，任选其一。

Authorization Bearer：

```http
Authorization: Bearer <LOCAL_API_KEY>
```

自定义 Header：

```http
X-MacMima-Local-Api-Key: <LOCAL_API_KEY>
```

## 新增数据库凭证

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
        "description": "系统用户表"
      },
      {
        "name": "credentials",
        "description": "凭证密文和同步元数据"
      }
    ],
    "tags": ["local", "mysql"]
  }'
```

`scope` 可选：

- `personal`：写入个人密区
- `shared`：写入共享密区，需要当前用户拥有共享区权限

## 新增 API Key

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

## 字段说明

通用字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 凭证标题 |
| `category` | string | `server`、`website`、`api_key`、`database`、`other` |
| `scope` | string | `personal` 或 `shared` |
| `tags` | string[] | 标签 |
| `data` | object | 自定义数据对象 |

常见直传字段：

| 字段 | 说明 |
| --- | --- |
| `host` | 服务器或数据库主机 |
| `port` | 端口 |
| `database` | 数据库名 |
| `username` | 用户名 |
| `password` | 密码 |
| `connectionString` | 连接字符串 |
| `url` | 网站地址 |
| `email` | 登录邮箱 |
| `apiKey` | API Key |
| `apiSecret` | API Secret |
| `accessKeyId` | Access Key ID |
| `accessKeySecret` | Access Key Secret |
| `tables` | 数据库表名和说明 |
| `databaseTables` | 数据库表名和说明 |
| `tableRelations` | 数据库表名和说明 |

## 响应示例

成功：

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

常见错误：

| 状态码 | 说明 |
| --- | --- |
| `401` | Local API Key 不正确 |
| `404` | 接口不存在 |
| `423` | MacMima 未打开或未解锁 |
| `504` | 前端保存超时 |

## 安全建议

- 本地 API 收到的凭证会交给已解锁的桌面端加密，再通过后端 API 保存。
- 后端数据库保存的是密文、IV、认证标签和元数据，不应出现本地 API 推送的明文凭证正文。
- Local API Key 只给本机可信工具使用。
- 不要把 Local API Key 写入公开仓库。
- 不使用时关闭本地 API。
- 推送共享密区前确认团队成员是否都应该看到该凭证。
