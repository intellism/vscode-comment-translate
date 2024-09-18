# VSCode 注释翻译

VSCode 翻译插件，帮助开发者翻译代码中的注释、字符串、代码提示、错误提醒、变量名称等。

![Licence](https://img.shields.io/github/license/intellism/vscode-comment-translate.svg)

## 简介
[【English】](./doc/README.md) [【日本語の文書】](./doc/README_JA.md) [【한국어】](./doc/README_KR.md)

许多优秀的项目都有丰富的注释，使用者可以快速理解代码意图。但是如果使用者不熟悉注释的语言，会带来理解困难。本插件提供丰富的翻译场景，帮助开发者更轻松地理解和编写多语言代码。插件支持了Google、Bing、AliCloud、DeepL常见翻译服务，并允许开发者自定义添加翻译服务。


![Introduction](./image/Introduction.gif)

## 功能

- **代码阅读**
  - Hover翻译: 移动鼠标到注释、字符串、选区，会显示翻译内容。如果有其他Hover内容如异常、代码文档，也会被翻译显示显示
  - 沉浸式阅读: 打开沉浸式注释翻译，会自动翻译注释并在文档中显示。支持翻译结果对照原文显示或占位显示
- **翻译替换**
  - 翻译变量命名：通过当前描述翻译成英文后，提供各种变量命名，选中后替换原描述
  - Hover替换: Hover显示翻译框中,提供替换功能，选中后替换翻译结果到原文
  - 全文替换翻译：支持字符串、注释、选区,一键全文替换成翻译文本
- **GitHub Copilot 翻译**
  > 需要依赖提前安装github copilot chat插件，并拥有github copilot chat插件的授权
  - @translate: 在GitHub Copilot Chat中进行翻译。选择文本后，可以快速翻译并发送到GitHub Copilot Chat。

## 有用的命令

> Mac: `ctrl+shift+?` / Windows: `alt+shift+?`

插件提供了各类场景的翻译或替换命令,部分常用功能预设了快捷键。用户也可以通过自己习惯，自定义快捷键。
- **沉浸式注释翻译**：开启/关闭当前文档的沉浸式翻译阅读 `ctrl+shift+z`
- **沉浸式显示方式**：切换对照/占位阅读方式 `ctrl+shift+b`
- **翻译变量命名**：当前描述词中翻译并提供命名变量 `ctrl+shift+n`
- **翻译替换**：选中内容翻译并替换到当前位置 `ctrl+shift+t`
- **Copilot 快捷翻译**：选中内容或剪贴板，在GitHub Copilot Chat中进行翻译 `ctrl+shift+y`


## 翻译服务

本插件支持以下翻译服务：
- Google 翻译
- Bing 翻译
- Baidu 翻译
- AliCloud 翻译
- DeepL 翻译

## 支持我们

如果你觉得这个插件对你有帮助，请考虑通过以下方式支持我们：
- 在 GitHub 上给我们一个 Star
- 向我们提交反馈和建议
- 分享给你的朋友和同事

## 参考文档
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
- [Visual Studio Code 插件开发文档](https://code.visualstudio.com/api)
