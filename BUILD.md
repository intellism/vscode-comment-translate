# VS Code 扩展打包编译指南

本文档说明如何将 `vscode-comment-translate` 扩展打包编译成 `.vsix` 文件。

## 前置要求

- **Node.js** (推荐版本 >= 14.x)
- **npm**

## 打包步骤

### 1. 安装依赖

```bash
npm install
```

失败的话尝试：
```
npm install --ignore-scripts
```

### 2. 打包成 VSIX 文件

推荐使用以下命令打包，会自动增加版本号并生成 VSIX 文件：

```bash
npm run package:vsix
```

或者跳过测试（不推荐）：

```bash
npm run package:vsix:skip-test
```

打包时会**自动增加版本号**（patch 版本，如 3.0.1 → 3.0.2），并更新 `package.json` 中的版本号。

打包成功后，会在项目根目录生成 `.vsix` 文件：
```
comment-translate-<version>.vsix
```

> **注意**：如果直接使用 `npx @vscode/vsce package`，不会自动增加版本号。建议使用 `npm run package:vsix`。

## 安装 VSIX 文件

### 方法 1：使用 VS Code 命令行

```bash
code --install-extension comment-translate-<version>.vsix
```

### 方法 2：在 VS Code 中手动安装

1. 打开 VS Code
2. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac) 打开命令面板
3. 输入 `Extensions: Install from VSIX...`
4. 选择生成的 `.vsix` 文件

## 版本号管理

打包时会自动增加 patch 版本号。如果需要手动控制版本号类型：

| 命令 | 说明 | 示例 |
|------|------|------|
| `npm run version:patch` | 增加 patch 版本（3.0.1 → 3.0.2） | 修复 bug |
| `npm run version:minor` | 增加 minor 版本（3.0.1 → 3.1.0） | 新功能 |
| `npm run version:major` | 增加 major 版本（3.0.1 → 4.0.0） | 重大变更 |

手动设置版本号后，再执行打包：
```bash
npm run version:minor  # 先设置版本号（如 3.0.1 → 3.1.0）
npm run package:vsix   # 再打包（注意：这会将版本号再增加一次 patch）
```

或者先设置版本号，然后直接使用 vsce（不会再次增加版本号）：
```bash
npm run version:minor  # 先设置版本号
npx @vscode/vsce package  # 直接打包，不再增加版本号
```

## 其他命令

| 命令 | 说明 |
|------|------|
| `npm run package:vsix` | 打包 VSIX 文件并自增版本号（推荐） |
| `npm run package:vsix:skip-test` | 打包 VSIX 文件并自增版本号，跳过测试 |
| `npm run package` | 编译并自增版本号（不生成 VSIX） |
| `npm run package:skip-test` | 编译并自增版本号，跳过测试 |
| `npm run webpack` | 开发模式编译 |
| `npm test` | 运行测试 |

---

如有问题，请参考项目 [README.md](./README.md) 或提交 Issue。
