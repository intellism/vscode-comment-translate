# VSCode 注释翻译

VSCode 翻译插件，帮助开发者翻译代码中的注释、字符串、代码提示、错误提醒、变量名称等。

![Licence](https://img.shields.io/github/license/intellism/vscode-comment-translate.svg)

## 简介
[【English】](./doc/README.md) [【日本語の文書】](./doc/README_JA.md) [【한국어】](./doc/README_KR.md)

许多优秀的项目都有丰富的注释，使用者可以快速理解代码意图。如果使用者不熟悉注释的语言，会带来理解困难。本插件提供丰富的翻译场景，帮助开发者更轻松地理解和编写多语言代码。插件支持了Google、Bing、AliCloud、DeepL常见翻译服务，并允许开发者自定义添加翻译服务。

![Introduction](./image/Introduction.gif)

## 功能

### 代码阅读
源码中有注释，字符串文本等多语言内容，插件通过TextMate识别这些内容，可以快速翻译,通过Hover悬浮显示,尽可能减少对开发的干扰。

**Hover翻译**: 移动鼠标到注释、字符串、选区等，会悬浮显示翻译后内容。如果有其他Hover内容如异常、代码文档，也会被翻译显示

**沉浸式阅读**: 打开沉浸式注释翻译，会自动翻译注释并在文档中显示。支持翻译结果对照原文显示或占位显示,通过配置或快捷键`Ctrl+Shift+B`切换显示方式。
![Immersive](./image/Immersive.gif)

### 翻译并替换
插件不仅可以翻译源码中的内容，还支持快速将翻译内容替换到文档中。如翻译一段描述，并作为变量名使用；多语言开发场景中，翻译一段字符串，并替换到文档中。

**翻译变量命名**：通过当前描述翻译成英文后，提供各种变量命名，选中后替换原描述
![naming](<./image/full naming.gif>)

**Hover替换**: 悬浮显示翻译框中,提供替换功能，选中后翻译结果会替换原文内容
![hover](./image/hover_image.png)

**全文替换翻译**：支持字符串、注释、选区,一键全文替换成翻译文本
![replace](./image/replace.png)

### GitHub Copilot 翻译
  > 需要依赖提前安装github copilot chat插件，并拥有github copilot chat插件的授权
  > 针对Github Copilot用户，目前支持的Chat框内翻译，暂时不支持注释、文本等会内容使用该功能进行翻译。

本插件扩展了GitHub Copilot,可以在Chat框中通过`@translate`进行翻译,会通过Copilot提供的AI大模型进行文本翻译,翻译目标语言为CommentTranslate设置的目标语言。
其次,在Editor中选择文本后，可以通过命名快速发送到GitHub Copilot Chat进行翻译。
![copilot](./image/copilot.gif)

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
- **Google 翻译**: 内置,免费版。 默认使用
  - **注**：对网络有要求，部分用户需要代理。如遇网络问题，建议使用Bing
- **Bing 翻译**: 内置,免费版。
- **AliCloud 翻译**: 内置,需要配置accessKeyId & accessKeySecret
  
三方提供的翻译服务可以在插件市场搜索`@tag:translateSource`找到。
用户可以通过插件配置选择需要使用的翻译服务，或者自定义扩展翻译服务。 [更多链接](https://github.com/intellism/vscode-comment-translate/wiki/%E7%BF%BB%E8%AF%91%E6%9C%8D%E5%8A%A1)

## 支持我们

如果你觉得这个插件对你有帮助，请考虑通过以下方式支持我们：
- 在 GitHub 上给我们一个 Star
- 向我们提交反馈和建议
- 分享给你的朋友和同事

## 参考文档
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
- [Visual Studio Code 插件开发文档](https://code.visualstudio.com/api)
