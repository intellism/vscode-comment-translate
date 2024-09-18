# Change Log
All notable changes to the "comment-translate" extension will be documented in this file.
Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
### Add
 * 独立Pannel
   * 翻译历史
   * 多翻译源对比
   * i18n
   * 翻译详情
     * 核心单词
     * 例句
   * 生词本
 * 添加更多翻译源,for API版本的
   * google for api
   * bing for api
   * baidu for api
   * deepl for api
   * yadex for api
 

### Change
* i18n 支持更多语言。 代码内支持

## [3.0.0] 2024-9-17
### Add
* 沉浸式: 注释
* 变量翻译替换
* github copilot翻译 
   > 需要github copilot插件,并授权调用模型
* Markdown,Hover 段落翻译

### Change
* 互译支持，待翻译文本是目标语言，反向翻译源语言（可以设置`commentTranslate.sourceLanguage`，默认English）
* 优化文档，默认改为英文文档。

### Fixed
* 移除 **划词翻译** 引起的编辑失焦

## [2.3.3] 2023-12-10

### Fixed
* Hover划词翻译焦点Bug修复 https://github.com/intellism/vscode-comment-translate/issues/187
* 全文翻译显示进度 https://github.com/intellism/vscode-comment-translate/issues/187


## [2.3.1] 2023-7-11
### Added
* 添加配置
   * 添加 `commentTranslate.sourceLanguage` 选项，指定当前翻译语言，默认 'auto'交由翻译引擎判断

### Fixed
* Hover翻译内容，处理Markdown使用单行处理方法，在 链接中包含 \n 会出现格式错误
 * HoverContent 无翻译内容，直接忽略翻译提示.  https://github.com/intellism/vscode-comment-translate/issues/175


## [2.3.0] 2023-6-13
### Change
  * 优化Hover Content翻译，格式尽可能保留，仅翻译显示文本信息。
  * 新增配置最长翻译长度配置`commentTranslate.maxTranslationLength`， 规避过长字符翻译引起收费过多问题
  * 新增google翻译代理配置 `commentTranslate.googleTranslate.mirror`，解决国内服务不可访问问题
  * 内在场景 textmate 语法，解决wsl模式下不生效问题
### Fixed
  * 内容中有 ")" 会与Markdown冲突。 hover command会出问题
  * 限制超长单行文本处理，与textmate配置相同。 解决内存消耗过多问题
  * 修复bing翻译不可用问题


## [2.2.2] 2022-6-29
### Change
  * 优化代码
    * 删除不必要的内容
    * 移除request,切换到got
  * Hover位置，调整为光标附近。可以通过配置 `hover.nearShow` 关闭 
### Fixed
  * 修复 Replace & Select 按钮命令失效问题

## [2.2.1] 2022-6-27
### Change
 * 性能优化
  * 重构，移除server代码，迁移到client
  * 插件捆绑依赖，减少文件加载. 插件发布版本廋包(20M到1.5M)

## [2.2.0] 2022-6-15
### Added
 * 翻译Hover弹出层内容
   * 注：忽略只有代码片段内容
   * 注：翻译跳过，链接、图片、代码块

### Changed
* 翻译限制3000字符调整到10000字符

### Fixed
* 修复分段翻译超值maxLen限制bug


## [2.1.1] 未发布

### Changed
* 翻译替换时，目标语言默认使用系统阅读的配置，如需要单独选择，可以通过 `commentTranslate.selectTargetLanguageWhenReplacing` 配置开启
* 添加插件点亮  Download Rate MIT
* 放开快速选择所有“字符串”或“注释”命令入口

### Fixed
* 翻译替换修复 `.yaml .properties` 字符的支持

## [2.1.0] 2022-6-1

### Added
 * 支持翻译(选中)文件功能
   * 注释
   * 文本

### Changed
 * 启动时机改为 “闲时”


### Fixed
 * dart语言注释识别错误优化。
 * txt 选区翻译支持

## [2.0.1] 2022-1-27
  
### Added
   * 新增翻译剪贴板命令
### Changed
   * 安装翻译源插件，自动启用配置
   * 状态栏Hover Tips添加“切换翻译源”命令快捷链接
   * 快捷键替换。mac 下 ctrl+?,win下  alt+?
### Fixed
   * 修复翻译替换失灵问题。  [#83](https://github.com/intellism/vscode-comment-translate/issues/83)

## [2.0.0] 2022-1-1
  
### Added
 * hover框，添加场景命令。select、replace、config
 * hover 展示显示对应的 languageId
 * 减少翻译频率，减少API的请求。
   * 对字符串、变量不再默认hover翻译；
   * 添加快速开启和关闭hover翻译命令，状态栏可以快速切换；
   * 本地存储翻译结果，相同内容不再重复请求；
* 对合并多行，进一步优化。更精确翻译内容
   * 修复之前python等的兼容
   * 支持跳过翻译内容的正则配置。
* 支持翻译源插件能力，开发者可以自由添加翻译源
  
### Changed
* 仅仅翻译有效文本，保留格式符号:``` // * # <!-- --> ```
* 配置调整
   * 细化配置调整项目。默认关闭，变量名-字符串的翻译(引导-划词翻译)。
* 优化：静默模式下，划词翻译，直接显示结果. (增加划词翻译快捷开关)
* 重构
   * hover逻辑切换到client

## [1.5.0] 2021-8-2
### Added
* 增加baidu、bing翻译源. 同ip翻译过多google会限制访问，可以临时切换其他翻译源
* 增加翻译目标语言选项 [Google Language support](https://cloud.google.com/translate/docs/languages)
* “翻译替换”，选择翻译目标语言，并增加快捷键 control + shift + t


## [1.4.2] - 2019-11-11
### Fixed
 * 修复vscode-textmate引入问题
   * webAssembly 模式
   * https://github.com/intellism/vscode-comment-translate/issues/30
   * https://github.com/intellism/vscode-comment-translate/issues/10

### Changed
   * 新增 简洁模式
     * 启动配置后，hover默认不翻译，仅按下Ctrl or Command才启动翻译。 翻译替换除外

## [1.4.1] - 2019-4-24

### Fixed
 * 请求错误后，Sever服务中断。
   * google api切换client t到gtx
   * 接口返回状态错误，直接抛出异常，5分钟后重试
   * 局域网同一IP请求量过多，还有拒绝服务风险，继续跟进

## [1.4.0] - 2019-4-20

### Changed
 * 添加目标语言配置枚举描述
 * 翻译并替换选择内容
 * 命令&配置多语言支持
    * 支持中文&日语

### Fixed
 * 文档变更后，缓存没有淘汰

## [1.3.6] - 2019-4-15
### Changed
 * 性能优化，缓存解析对象减少重复计算，关闭文档时移除相关缓存减少内存占用


## [1.3.5] - 2019-4-14
### Fixed
 * 修复未选择语言错误

## [1.3.2] - 2019-4-14
### Add
 * 支持配置翻译类型
    * statusBar支持快速切换目标语言配置

### Fixed
 * 注释中包含markdown其他类型时，不可以连续翻译

### Removed
 * 文本翻译, markdown plaintext翻译 - 已支持选中内容翻译，改需求取消

## [1.3.1] - 2019-4-14
### Add
 * 选择区域翻译
   * hover到选择区域时，翻译该区域内容

## [1.3.0] - 2019-4-14
### Changed
 * 重构 comment 翻译，使用与变量相同翻译方法
 * 变量翻译优化
    * 新增快速选中最后一次翻译区域命令
        * 默认命令 ctrl + shift + s
### Fixed
 * 修复字符串中包含转义符的 \n \' \"
 * server异常时，反复弹出日志
 * Object表达式支持

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
 * window、linux 依赖vscode-text错误，切换到vscode自带版本 
