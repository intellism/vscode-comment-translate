# VSCode 注释翻译插件

这个插件帮助开发者翻译代码中的注释、字符串、代码提示、错误提醒和变量名称等内容。

![Licence](https://img.shields.io/github/license/intellism/vscode-comment-translate.svg)

## 简介
[【English】](../README.md) [【日本語の文書】](./README_JA.md) [【한국어】](./README_KR.md)

许多优秀的项目都有丰富的注释，帮助使用者快速理解代码意图。如果使用者不熟悉注释的语言，会带来理解困难。本插件提供多种翻译场景，帮助开发者更轻松地理解和编写多语言代码。插件支持Google、Bing、AliCloud、DeepL等常见翻译服务，并允许开发者自定义添加翻译服务。

![Introduction](./image/Introduction.gif)

## 功能

### 代码阅读
插件通过TextMate识别源码中的注释、字符串等多语言内容，快速翻译并通过Hover悬浮显示，尽量减少对开发的干扰。

**Hover翻译**: 移动鼠标到注释、字符串或选区上，会悬浮显示翻译后的内容。如果有其他Hover内容如异常、代码文档，也会被翻译显示。

**沉浸式阅读**: 打开沉浸式注释翻译，会自动翻译注释并在文档中显示。支持翻译结果对照原文显示或占位显示，通过配置或快捷键`Ctrl+Shift+B`切换显示方式。
![Immersive](./image/Immersive.gif)

### 翻译并替换
插件不仅可以翻译源码中的内容，还支持快速将翻译内容替换到文档中。例如，翻译一段描述并作为变量名使用；在多语言开发场景中，翻译一段字符串并替换到文档中。

**翻译变量命名**：将当前描述翻译成英文后，提供各种变量命名，选中后替换原描述。
![naming](<./image/full naming.gif>)

**Hover替换**: 悬浮显示翻译框中，提供替换功能，选中后翻译结果会替换原文内容。
![hover](./image/hover_image.png)

**全文替换翻译**：支持字符串、注释、选区，一键全文替换成翻译文本。
![replace](./image/replace.png)

### GitHub Copilot Chat Participant: @translate
  > - 需要提前安装GitHub Copilot Chat插件，并拥有其授权。
  > - 针对GitHub Copilot用户，目前支持在Chat框内翻译，暂时不支持注释、文本等内容使用该功能进行翻译。

本插件扩展了GitHub Copilot，可以在Chat框中通过`@translate`进行翻译，使用Copilot提供的AI大模型进行文本翻译，翻译目标语言为CommentTranslate设置的目标语言。在Editor中选择文本后，可以通过命令快速发送到GitHub Copilot Chat进行翻译。
![copilot](./image/copilot.gif)

## 有用的命令

> Mac: `ctrl+shift+?` / Windows: `alt+shift+?`

插件提供了各类场景的翻译或替换命令，部分常用功能预设了快捷键。用户也可以根据自己的习惯，自定义快捷键。
- **沉浸式注释翻译**：开启/关闭当前文档的沉浸式翻译阅读 `ctrl+shift+z`
- **沉浸式显示方式**：切换对照/占位阅读方式 `ctrl+shift+b`
- **翻译变量命名**：当前描述词中翻译并提供命名变量 `ctrl+shift+n`
- **翻译替换**：选中内容翻译并替换到当前位置 `ctrl+shift+t`
- **Copilot 快捷翻译**：选中内容或剪贴板，在GitHub Copilot Chat中进行翻译 `ctrl+shift+y`

## 翻译服务

本插件支持以下翻译服务：
- **Google 翻译**: 内置，免费版。 默认使用
  - **注**：对网络有要求，部分用户需要代理。如遇网络问题，建议使用Bing
- **Bing 翻译**: 内置，免费版。
- **AliCloud 翻译**: 内置，需要配置accessKeyId & accessKeySecret
  
第三方提供的翻译服务可以在插件市场搜索`@tag:translateSource`找到。用户可以通过插件配置选择需要使用的翻译服务，或者自定义扩展翻译服务。 [更多链接](https://github.com/intellism/vscode-comment-translate/wiki/%E7%BF%BB%E8%AF%91%E6%9C%8D%E5%8A%A1)

## 常用配置
* `commentTranslate.hover.enabled`: 开启/关闭悬停翻译（可以通过状态快速设置）
* `commentTranslate.hover.concise`: 开启/关闭简洁模式。开启后只有按住ctrl或command才会触发悬浮翻译
* `commentTranslate.hover.string`: 开启/关闭字符串悬停翻译
* `commentTranslate.hover.content`: 开启/关闭翻译悬停内容
* `commentTranslate.multilineMerge`: 合并多行注释
* `commentTranslate.targetLanguage`: 翻译目标语言，没有设置的情况下使用vscode本地语言。（可以通过状态快速设置）
* `commentTranslate.source`: 翻译服务源配置。建议通过命令完成设置。 支持插件扩展翻译服务源。 [example](https://github.com/intellism/deepl-translate)
* `commentTranslate.maxTranslationLength`: 最长翻译长度配置。规避过长字符翻译引起收费过多问题
* `commentTranslate.browse.enabled`: 开启/关闭项目沉浸浏览翻译功能
* `commentTranslate.googleTranslate.mirror`: 解决国内服务不可访问问题。 [文档](https://hcfy.app/blog/2022/09/28/ggg#%E6%96%B9%E6%A1%88-c%E4%BD%BF%E7%94%A8%E9%95%9C%E5%83%8F%E5%9C%B0%E5%9D%80%E6%9C%80%E7%AE%80%E5%8D%95)

## 支持我们

如果你觉得这个插件对你有帮助，请考虑通过以下方式支持我们：
- 在 GitHub 上给我们一个 Star [intellism/vscode-comment-translate](https://github.com/intellism/vscode-comment-translate)
- 向我们提交反馈和建议
- 分享给你的朋友和同事
