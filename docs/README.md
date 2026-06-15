# MacMima 文档总目录

这里整理 MacMima 开源项目的主要文档。第一次阅读建议按顺序看。

English documentation: [docs/en/README.md](./en/README.md)

## 推荐阅读顺序

1. [产品介绍](./INTRODUCTION.md)
2. [安全策略](../SECURITY.md)
3. [APP 使用方法](./APP_USAGE.md)
4. [后端部署教程](./BACKEND_DEPLOYMENT.md)
5. [技术文档](./TECHNICAL_OVERVIEW.md)
6. [本地 API 接入](./LOCAL_API.md)
7. [发布与安装包构建](./RELEASES.md)

## 按角色阅读

个人开发者：

- [产品介绍](./INTRODUCTION.md)
- [APP 使用方法](./APP_USAGE.md)
- [安全策略](../SECURITY.md)

自托管维护者：

- [后端部署教程](./BACKEND_DEPLOYMENT.md)
- [安全策略](../SECURITY.md)
- [技术文档](./TECHNICAL_OVERVIEW.md)

集成工具开发者：

- [本地 API 接入](./LOCAL_API.md)
- [技术文档](./TECHNICAL_OVERVIEW.md)

贡献者：

- [贡献指南](../CONTRIBUTING.md)
- [技术文档](./TECHNICAL_OVERVIEW.md)
- [发布与安装包构建](./RELEASES.md)
- [安全策略](../SECURITY.md)

## 重要安全提醒

MacMima 后端数据库不保存明文凭证正文。网站密码、数据库密码、API Key、SSH
私钥和连接字符串会先在桌面端加密，再同步到后端。

但标题、分类、标签、时间戳等元数据为了检索和展示是明文保存的。不要把真正的
Secret 写进标题或标签。
