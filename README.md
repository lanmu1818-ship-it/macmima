<p align="center">
  <img src="./build/icon.png" alt="MacMima Logo" width="96" height="96" />
</p>

<h1 align="center">MacMima</h1>

<p align="center">
  为新晋 AI 开发者准备的账号、密码、API Key、服务器密钥、数据库凭证与团队配置安全储存方案。
</p>

<p align="center">
  <a href="https://macmima.flnxi.com">官网演示</a>
  ·
  <a href="./docs/APP_USAGE.md">APP 使用方法</a>
  ·
  <a href="./docs/BACKEND_DEPLOYMENT.md">后端部署教程</a>
  ·
  <a href="./docs/TECHNICAL_OVERVIEW.md">技术文档</a>
</p>

## 项目定位

AI 开发者很快会积累一批高敏感资料：模型平台 API Key、云服务器 SSH
密钥、数据库账号密码、管理后台账号、Webhook Secret、团队共享配置等。
把这些资料散落在聊天记录、备忘录、表格或浏览器里，既难协作，也很难保证安全。

MacMima 是一个开源桌面密钥库，目标是把这些开发凭证收进一个可自托管、
可团队协作、默认加密的工作台里。

## 核心能力

- 个人密区：保存只有自己能解密的账号、密码、Key、服务器和数据库凭证。
- 共享密区：管理员可为用户开启共享区权限，让同一后端下的成员协作使用共享配置。
- 数据库表关系：数据库凭证可记录表名和说明，方便 AI 项目开发时快速理解数据结构。
- 本地 API：桌面端可开启 `127.0.0.1` 本地接口，让其他工具自动推送凭证。
- 工作台 Key：同一个后端可按工作台 Key 隔离团队数据。
- 管理后台：管理用户、邀请码、共享区访问权限。
- 自托管后端：Express + Prisma + MySQL，可部署在自己的服务器上。
- 跨平台打包：Electron 支持 macOS 与 Windows 构建。

## 安全模型简述

MacMima 的基本原则是：后端负责同步和权限，敏感内容在桌面端加密后再上传。

- 个人密区使用用户主密码派生 AES-GCM 密钥。
- 共享密区当前使用工作台 Key 派生共享密钥。
- 用户主密码不直接发送到后端。
- 后端登录校验值使用 Argon2id 和服务端 `AUTH_PEPPER` 加固。
- 本地 API 只监听 `127.0.0.1`，并要求独立 Local API Key。

完整安全说明和后续加固路线见 [SECURITY.md](./SECURITY.md)。

## 快速开始

要求：

- Node.js 20+
- pnpm 9+
- MySQL 8+

启动桌面端开发环境：

```bash
pnpm install
pnpm dev
```

启动 Electron 开发环境：

```bash
pnpm electron:dev
```

启动后端：

```bash
cd server
pnpm install
cp .env.example .env
npx prisma generate
npx prisma db push
pnpm build
pnpm start
```

后端生产部署请看 [后端部署教程](./docs/BACKEND_DEPLOYMENT.md)。

## 文档

- [产品介绍](./docs/INTRODUCTION.md)
- [APP 使用方法](./docs/APP_USAGE.md)
- [后端部署教程](./docs/BACKEND_DEPLOYMENT.md)
- [技术文档](./docs/TECHNICAL_OVERVIEW.md)
- [本地 API 接入](./docs/LOCAL_API.md)
- [安全策略](./SECURITY.md)
- [贡献指南](./CONTRIBUTING.md)

## 目录结构

```text
.
├── electron/          # Electron main/preload 和本地 API
├── src/               # React 桌面应用
├── server/            # Express + Prisma 后端
│   ├── prisma/        # Prisma schema
│   └── src/           # API 源码
├── build/             # App 图标和打包资源
├── public/            # 静态资源
└── docs/              # 开源文档
```

官网源码与发布管理后台不包含在本次公开源码树中，是否公开将单独决定。

## 构建安装包

```bash
pnpm electron:build
pnpm electron:build:win
```

安装包会输出到 `release/`，该目录已被 Git 忽略。

## 当前开源状态

当前质量门槛：

```bash
pnpm exec tsc --noEmit
cd server && pnpm build && pnpm audit --prod
```

ESLint 历史问题仍在清理中，建议在接受外部 PR 前继续收紧 lint 和测试门槛。

## License

MIT
