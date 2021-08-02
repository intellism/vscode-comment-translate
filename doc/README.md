# VSCode Comment Translate

## Introduction
[【中文文档】](../README.md) [【日本語の文書】](./README_JA.md)

Many excellent projects have a lot of annotations, and users can quickly understand the code intent. However, if the user is not familiar with the annotated language, it will bring difficulties in understanding. This plugin uses the Google Translate API to translate comments for the VSCode programming language.
## v1.5.0 update
* Increase baidu, bing translation sources. Too many translations with the same ip google will restrict access, you can temporarily switch to other translation sources
* Increase translation target language options [Google Language support](https://cloud.google.com/translate/docs/languages)
* "Translation replacement", select the target language for translation, and add shortcut keys control + shift + t

## Features
1. Identify the comment portion of the code without interfering with reading. Support for different languages, single-line, multi-line comments
![Introduction](./image/cn/Introduction.gif)

2. Support user string and variable translation to support hump split
![Introduction](./image/cn/variable.gif)

3. Select the last translation area
![Introduction](./image/cn/select.gif)

4. Translate and replace selections
![Introduction](./image/translate-selections.gif)

5. Selection range translation
![Introduction](./image/cn/selection.gif)

## Settings Options
#### Multi-language support
Status bar to quickly configure the target language  [Google Language support](https://cloud.google.com/translate/docs/languages)
![Multi-language](./image/cn/status-bar.gif)


#### Merge multiple lines of comments (source language only supports English)
![Multi-line-merge](./image/multi-line-merge.gif)