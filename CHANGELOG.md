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
 * 选择内容替换翻译
    * 支持多区域翻译


### Changed
 * 重构 comment 翻译，使用与变量相同翻译方法
 * 变量翻译优化
    * 支持配置翻译类型
    * 新增快速选中最后一次翻译区域命令 (ctrl + shift + s) 
    * 新增翻译并替换选择内容 (ctrl+shift +t)
 * hover 展示显示对应的 languageId
 * 仅仅翻译有效文本，保留格式符号:``` // * # <!-- --> ```
 * add 配置描述 enumDescriptions

## [1.2.0] - 2019-4-10
### Added
 * 字符串与变量翻译
    * 翻译类型
        * 字符串内容翻译
        * 变量、函数、interface等名称翻译
        * support 语言默认支持lib翻译 
    * 支持驼峰拆分
## [1.1.0] - 2019-4-4

### fixed
* google服务器失败（流量异常）
    * 提示错误，保留Google 翻译快捷链接
    * 使用token版翻译方法
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
