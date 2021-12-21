# Change Log
All notable changes to the "comment-translate" extension will be documented in this file.
Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
### Added
 * 变量命名
    * 中文翻译到驼峰的变量命名
 * 翻译源添加
   * 添加google收费API配置
   * DeepL、Baidu、Yandex等收费API
 * 优化翻译逻辑，支持正则忽略
   * 内置场景注释忽略逻辑
### Changed
* 合并注释更合理支持
   * block 注释多行合并。 
   * line注释，提前 标识符，支持非 // 行注释
* 跳转到google translate服务器，markdown链接改为command,修复换行丢失
* 快捷键添加when条件，减少用户影响
* 配置调整
   * 关闭翻译，切换翻译源快捷入口。 目标语言切换更一级
* 重构
   * 翻译源剥离、支持外部插件扩展翻译源

### Fixed
 * 请求错误后，5分钟禁止访问结果被错误cache

## [2.0.0] 2022-1-1
### Added
 * hover框，添加场景命令。select、replace、config
 * hover 展示显示对应的 languageId
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
