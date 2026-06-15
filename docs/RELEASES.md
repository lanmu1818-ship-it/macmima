# 发布与安装包构建

本文说明 MacMima 桌面端安装包的构建方式，以及 Windows 正式安装器和便携 ZIP 的区别。

## 发布物类型

| 平台 | 正式发布物 | 说明 |
| --- | --- | --- |
| macOS | `MacMima-版本-arm64.dmg` | 面向 Apple Silicon Mac 的标准 DMG 安装包 |
| Windows | `MacMima-版本-Setup-x64.exe` | NSIS 安装器，会创建桌面快捷方式和开始菜单快捷方式 |
| Windows | `.zip` | 便携版，只适合内部测试或备用分发，不会自动创建桌面图标 |

官网默认下载入口应优先使用正式安装器。Windows ZIP 包不要标记为“安装包”，否则用户会误以为安装后应该自动出现在桌面和开始菜单。

## 本地构建

安装依赖：

```bash
pnpm install
```

构建 macOS 包：

```bash
pnpm electron:build
```

构建 Windows 包：

```bash
pnpm electron:build:win
```

注意：在 Apple Silicon Mac 上交叉构建 Windows NSIS 安装器可能会因为 Wine 架构不匹配失败。正式 Windows 安装器建议在 Windows 环境或 GitHub Actions 的 `windows-latest` Runner 上构建。

## GitHub Actions 构建 Windows 安装器

仓库已提供工作流：

```text
.github/workflows/build-windows.yml
```

手动构建步骤：

1. 打开 GitHub 仓库的 `Actions` 页面。
2. 选择 `Build Windows Installer`。
3. 点击 `Run workflow`。
4. 分支选择 `main`。
5. 等待工作流完成。
6. 在运行详情页下载 artifact：`macmima-windows-installer`。
7. 解压 artifact，确认包含 `MacMima-版本-Setup-x64.exe`。

该 `.exe` 才是 Windows 正式安装器。安装后应能创建桌面快捷方式、开始菜单快捷方式，并出现在 Windows 已安装应用列表中。

## 上传到官网

如果项目维护者使用官网维护后台发布安装包：

1. 进入官网维护后台。
2. 平台选择 `Windows`。
3. 上传 `MacMima-版本-Setup-x64.exe`。
4. 版本号填写对应版本，例如 `1.0.0`。
5. 发布后确认官网 Windows 下载文件名以 `.exe` 结尾。

官网可以根据文件后缀显示不同说明：

- `.exe` 或 `.msi`：显示为正式安装器。
- `.zip`：显示为便携 ZIP，不承诺自动创建快捷方式。

## 发布前检查

发布前至少确认：

- 安装器可以在一台干净 Windows 机器上安装和启动。
- 桌面快捷方式存在。
- 开始菜单快捷方式存在。
- Windows “已安装的应用”中可以正常卸载。
- 首次启动仍要求用户配置后端地址和工作区 Key。
- 不要把 `.env`、私钥、部署日志、数据库备份或真实用户数据打进安装包。
