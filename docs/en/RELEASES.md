# Releases And Installer Builds

This document explains how MacMima desktop installers are built, and the difference
between the official Windows installer and a portable ZIP archive.

## Release Artifacts

| Platform | Official artifact | Notes |
| --- | --- | --- |
| macOS | `MacMima-<version>-arm64.dmg` | Standard DMG installer for Apple Silicon Macs |
| Windows | `MacMima-<version>-Setup-x64.exe` | NSIS installer with desktop and Start Menu shortcuts |
| Windows | `.zip` | Portable/internal testing build. It does not create shortcuts automatically |

The website download entry should prefer the official installer. Do not label a
Windows ZIP archive as an installer, because users will expect desktop shortcuts,
Start Menu entries, and a normal uninstall entry.

## Local Builds

Install dependencies:

```bash
pnpm install
```

Build macOS artifacts:

```bash
pnpm electron:build
```

Build Windows artifacts:

```bash
pnpm electron:build:win
```

Note: cross-building the Windows NSIS installer from an Apple Silicon Mac may fail
because Wine binaries can be architecture-incompatible. Build official Windows
installers on Windows, or use the GitHub Actions `windows-latest` runner.

## Build The Windows Installer With GitHub Actions

The repository includes this workflow:

```text
.github/workflows/build-windows.yml
```

Manual build steps:

1. Open the repository `Actions` page on GitHub.
2. Select `Build Windows Installer`.
3. Click `Run workflow`.
4. Select the `main` branch.
5. Wait for the workflow to finish.
6. Download the `macmima-windows-installer` artifact from the run page.
7. Extract the artifact and confirm it contains `MacMima-<version>-Setup-x64.exe`.

That `.exe` file is the official Windows installer. After installation, it should
create desktop and Start Menu shortcuts and appear in Windows installed apps.

## Publish To The Website

If the project maintainer uses the website admin console to publish installers:

1. Open the website admin console.
2. Select `Windows` as the platform.
3. Upload `MacMima-<version>-Setup-x64.exe`.
4. Set the matching version, for example `1.0.0`.
5. After publishing, confirm the website's Windows download filename ends with `.exe`.

The website can present different instructions based on the file extension:

- `.exe` or `.msi`: official installer.
- `.zip`: portable ZIP, no automatic shortcut creation promised.

## Pre-Release Checklist

Before publishing, verify:

- The installer installs and launches on a clean Windows machine.
- A desktop shortcut is created.
- A Start Menu shortcut is created.
- The app appears in Windows installed apps and can be uninstalled normally.
- First launch still asks the user to configure backend URL and workspace key.
- No `.env`, private keys, deployment logs, database backups, or real user data are
  included in the installer.
