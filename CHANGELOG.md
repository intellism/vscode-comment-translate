# Change Log
All notable changes to the "comment-translate" extension will be documented in this file.
Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
### Added
 * 多翻译源支持
    * 支持有道API
    * 分离google API CN, google API COM
 * 文本翻译
    * mackdown plaintext翻译
        * 按段落分割
        * 行分割
 * 单词翻译 (cmd + hover)触发
    * 分析变量和文本单词翻译
    * 支持驼峰拆分
    * 支持生词本记录
 * 选择内容替换翻译
    * 支持多区域翻译


### Changed
 * hover 展示显示对应的 languageId
 * 仅仅翻译有效文本，保留格式符号:``` // * # <!-- --> ```
 * add 配置描述 enumDescriptions

## [1.1.0] - 2019-2-14

### fixed
* google服务器失败（流量异常）
    * 提示错误，保留Google 翻译快捷链接
    * 网络请求失败后，5分钟内，不再发起请求
### Changed
 * 自动识别VSCode显示语言，作为默认 targetLanguage

 
## [1.0.0] - 2018-10-23
### Added 
 * 完成基础功能
 * 支持单行，多行翻译注释
 * 支持多语言切换
 * 支持英文多行合并翻译

### Fixed
 * window、linux 依赖vscode-text错误，切换到vsocde自带版本 
