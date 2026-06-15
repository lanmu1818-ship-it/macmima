# 技术文档

本文面向准备阅读源码、二次开发或自托管 MacMima 的开发者。

## 技术栈

桌面端：

- Electron
- React
- TypeScript
- Vite
- Zustand
- Tailwind CSS

后端：

- Node.js
- Express
- Prisma
- MySQL
- JWT
- Argon2id

## 架构概览

```mermaid
flowchart LR
  A["MacMima Desktop<br/>React UI"] --> B["Electron Main<br/>Local API"]
  A --> C["Crypto Module<br/>AES-256-GCM / PBKDF2 / Crypto v2"]
  A --> D["Backend API<br/>Express"]
  D --> E["Prisma ORM"]
  E --> F["MySQL"]
  G["Other Local Tools"] --> B
  B --> A
```

关键边界：

- React UI 负责登录、密钥派生、加密、解密和交互。
- Electron Main 负责窗口、系统能力和本地 API。
- Express 后端负责账号、权限、同步、讨论消息和密文储存。
- MySQL 储存用户、工作台、邀请码、凭证密文、文档密文、凭证元数据、历史版本和工作区讨论消息。

## 后端数据库里有什么

开发者最担心的问题通常是：既然数据同步到后端，那是不是所有密码都明文存在数据库里？

答案是否定的。MacMima 的 `credentials` 表保存的是加密结果和必要元数据。

| 字段类别 | 例子 | 明文可见性 |
| --- | --- | --- |
| 凭证正文 | 网站密码、数据库密码、API Key、SSH 私钥、连接字符串、Markdown 文档、数据库表说明 | 不明文保存，进入后端前已加密 |
| 加密结果 | `encryptedData`、`iv`、`authTag` | 明文保存加密结果，但不能直接使用 |
| 列表元数据 | `title`、`category`、`tags`、`scope`、时间戳 | 明文保存，用于展示和检索 |
| 登录材料 | 用户 salt、Argon2id verifier | 不包含明文主密码，不能解密个人密区 |

因此，如果只是 MySQL 数据库泄露，攻击者拿到的是密文和元数据，不是可直接使用的明文凭证。
但元数据仍可能暴露项目名称、服务名称、标签等信息，所以不要在标题或标签中写入真正的 Secret。

## 数据加密流程

### 个人密区

1. 用户输入主密码。
2. 前端使用用户 salt 和 PBKDF2 派生 AES-GCM 密钥。
3. 如果启用 Crypto v2，本机增强密钥会作为额外输入参与加密上下文；该增强密钥只保存在本机，不上传后端。
4. 凭证内容在前端加密。
5. 后端只接收 `encryptedData`、`iv`、`authTag` 和元数据。
6. 读取时前端拉取密文并在本地解密。

### 共享密区

历史 v1 共享密区使用工作台 Key 派生共享密钥，用于兼容旧数据。

Crypto v2 新共享记录使用独立的共享密区加密密钥。团队成员需要在个人设置中配置同一个共享密区密钥，
该密钥只保存在本机，不作为 `X-MacMima-Workspace-Key` 请求头发送给后端。这样即使后端数据库泄露，
攻击者也只能拿到共享密区密文和元数据。

共享密区仍要透明说明两个边界：

- 如果团队成员把共享密区密钥粘贴到聊天、日志、仓库或后端环境里，等同于把共享解密能力交出去。
- 如果使用旧 v1 数据，工作台 Key 仍可能影响共享区安全；建议编辑旧共享凭证后用 Crypto v2 重新保存。

后续安全路线：

- 为每个用户生成公私钥对。
- 共享密区使用随机 vault key。
- vault key 分别用成员公钥包装。
- 移除“知道工作台 Key 即可派生共享密钥”的弱点。

## 登录认证流程

MacMima 为了兼容“主密码用于本地加密”的设计，前端不会把明文主密码发给后端。

1. 注册时，前端生成 salt。
2. 前端计算登录校验 hash，这个 hash 不是用户明文主密码，也不能直接解密个人密区。
3. 后端把登录校验 hash 再用 Argon2id 和 `AUTH_PEPPER` 处理后入库。
4. 登录时后端校验 Argon2id verifier。
5. 校验通过后签发 JWT。

`AUTH_PEPPER` 必须只存在服务器环境变量中。如果数据库泄露，攻击者仍然不能直接拿库中 verifier 登录。

需要注意：登录校验 hash 在认证流程里相当于登录凭据，因此生产环境必须使用 HTTPS，
后端也不应记录请求体日志。

## 威胁场景说明

| 场景 | 结果 |
| --- | --- |
| 只泄露 MySQL 数据库 | 凭证正文仍是密文；攻击者可看到标题、分类、标签等元数据 |
| 泄露 `JWT_SECRET` | 可能伪造登录会话，但不能直接解密个人密区密文 |
| 泄露 `AUTH_PEPPER` 和数据库 | 登录 verifier 抗性下降，应立即轮换 pepper 并强制用户重新登录 |
| 用户忘记主密码 | 后端无法恢复个人密区明文 |
| 恶意或被篡改的客户端 | 可在加密前读取明文，这是任何客户端加密工具都必须防范的供应链风险 |
| 后端完全被入侵 | 可能影响认证、同步、聊天和旧 v1 共享密区安全；应轮换工作台 Key、JWT、pepper、数据库密码和共享密区密钥 |

## 数据库模型

| 模型 | 表名 | 说明 |
| --- | --- | --- |
| `Workspace` | `workspaces` | 工作台记录，按工作台 Key hash 隔离团队 |
| `User` | `users` | 用户、管理员状态、共享区权限 |
| `InviteCode` | `invite_codes` | 邀请码和使用次数 |
| `Credential` | `credentials` | 凭证和 Markdown 文档密文、分类、scope、标签 |
| `CredentialHistory` | `credential_history` | 凭证历史版本密文 |
| `SyncLog` | `sync_logs` | 同步记录 |
| `WorkspaceChatMessage` | `workspace_chat_messages` | 工作区讨论消息、图片附件元数据和脱敏状态 |

核心关系：

- 一个工作台下可以有多个用户、邀请码、凭证。
- 一个用户可以创建多个凭证。
- 凭证分为 `personal` 和 `shared` 两种 scope。
- `sharedAccess` 控制用户是否可访问共享密区。

## 后端 API 模块

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| Auth | `/api/auth` | 注册、登录、当前用户 |
| Credentials | `/api/credentials` | 凭证增删改查 |
| Admin | `/api/admin` | 用户管理、邀请码、共享权限 |
| Chat | `/api/chat` | 工作区讨论、成员列表、图片附件、分页加载 |
| Sync | `/api/sync` | 同步相关接口 |
| Health | `/health` | 健康检查 |

所有业务 API 都需要 `X-MacMima-Workspace-Key` 参与工作台隔离。

## 本地 API 模块

Electron Main 进程可以启动一个只监听 `127.0.0.1` 的 HTTP 服务。

默认端口：

```text
37621
```

核心接口：

- `GET /health`
- `POST /v1/credentials`

本地 API 收到请求后不会直接写数据库，而是把规范化后的 payload 发给前端。
前端确认当前用户已解锁后，对数据加密，再通过后端 API 保存。

`category: "document"` 可以用于推送 Markdown 文档；`scope: "shared"` 可保存到共享密区。

## 目录说明

```text
electron/
  main.ts       Electron 主进程、本地 API、窗口生命周期
  preload.ts    安全暴露给前端的 IPC API

src/
  pages/        主要页面
  components/   凭证卡片、表单、布局、本地 API bridge
  services/     后端 API client、本地加密配置
  stores/       Zustand 状态
  utils/        加密、剪贴板、导出工具

server/
  src/index.ts          Express 入口
  src/routes/auth.ts    注册、登录、JWT
  src/routes/admin.ts   管理员能力
  src/routes/credentials.ts 凭证接口
  src/routes/chat.ts    工作区讨论
  prisma/schema.prisma  数据模型
```

## 当前已知工程 TODO

- 补齐 Prisma migrations，替代生产环境 `db push`。
- 清理 ESLint 历史问题，并把 lint 纳入 CI 强制门槛。
- 增加端到端测试和后端 API 测试。
- 强化 Electron sandbox 和代码签名策略。
- 升级共享密区密钥分发方案为成员公钥包装 vault key。
- 补充工作区讨论消息保留策略和管理员审计策略。
