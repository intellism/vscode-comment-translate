# VSCode 注释翻译

## 简介
[【English】](./doc/README.md) [【日本語の文書】](./doc/README_JA.md)

许多优秀的项目，都有丰富的注释，使用者可以快速理解代码意图。但是如果使用者并不熟习注释的语言，会带来理解困难。本插件使用 Google Translate API 翻译 VSCode 的编程语言的注释。


## v1.5.0 更新
* 增加baidu、bing翻译源. 同ip翻译过多google会限制访问，可以临时切换其他翻译源
* 增加翻译目标语言选项 [Google Language support](https://cloud.google.com/translate/docs/languages)
* “翻译替换”，选择翻译目标语言，并增加快捷键 control + shift + t

## 功能
1. 识别代码中注释部分，不干扰阅读。支持不同语言，单行、多行注释
![Introduction](./doc/image/cn/Introduction.gif)

2. 支持用户字符串与变量翻译,支持驼峰拆分
![Introduction](./doc/image/cn/variable.gif)

3. 选择区域翻译 - 划词翻译
![Introduction](./doc/image/cn/selection.gif)

4. 翻译并替换选择内容
![Introduction](./doc/image/translate-selections.gif)

5. 选中最后一次翻译区域命令
![Introduction](./doc/image/cn/select.gif)

## 配置项
#### 多国语言支持
状态栏快速配置目标语言 [Google Language support](https://cloud.google.com/translate/docs/languages)
![Multi-language](./doc/image/cn/status-bar.gif)

#### 合并多行注释 （源语言只支持英语）
![Multi-line-merge](./doc/image/multi-line-merge.gif)