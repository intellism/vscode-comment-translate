# Change Log
All notable changes to the "comment-translate" extension will be documented in this file.
Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
### Added
 * 澶氱炕璇戞簮鏀寔
    * 鏀寔鏈夐亾API
    * 鍒嗙google API CN, google API COM
 * 鍙橀噺鍛藉悕
    * 涓枃缈昏瘧鍒伴┘宄扮殑鍙橀噺鍛藉悕
 * 缈昏瘧婧愭坊鍔�
   * 娣诲姞鐧惧害&鏈夐亾&yandex缈昏瘧婧�
   * 娣诲姞google鏀惰垂API閰嶇疆

### Changed
 * hover 灞曠ず鏄剧ず瀵瑰簲鐨� languageId
 * 浠呬粎缈昏瘧鏈夋晥鏂囨湰锛屼繚鐣欐牸寮忕鍙�:``` // * # <!-- --> ```
* 鍚堝苟娉ㄩ噴鏇村悎鐞嗘敮鎸�
   * block 娉ㄩ噴澶氳鍚堝苟銆� 
   * line娉ㄩ噴锛屾彁鍓� 鏍囪瘑绗︼紝鏀寔闈� // 琛屾敞閲�
* 璺宠浆鍒癵oogle translate鏈嶅姟鍣紝markdown閾炬帴鏀逛负command,淇鎹㈣涓㈠け

### Fixed
 * 璇锋眰閿欒鍚庯紝5鍒嗛挓绂佹璁块棶缁撴灉琚敊璇痗ache

## [1.4.2] - 2019-11-11
### Fixed
 * 淇vscode-textmate寮曞叆闂
   * webAssembly 妯″紡
   * https://github.com/intellism/vscode-comment-translate/issues/30
   * https://github.com/intellism/vscode-comment-translate/issues/10

### Changed
   * 鏂板 绠€娲佹ā寮�
     * 鍚姩閰嶇疆鍚庯紝hover榛樿涓嶇炕璇戯紝浠呮寜涓婥trl or Command鎵嶅惎鍔ㄧ炕璇戙€� 缈昏瘧鏇挎崲闄ゅ

## [1.4.1] - 2019-4-24

### Fixed
 * 璇锋眰閿欒鍚庯紝Sever鏈嶅姟涓柇銆�
   * google api鍒囨崲client t鍒癵tx
   * 鎺ュ彛杩斿洖鐘舵€侀敊璇紝鐩存帴鎶涘嚭寮傚父锛�5鍒嗛挓鍚庨噸璇�
   * 灞€鍩熺綉鍚屼竴IP璇锋眰閲忚繃澶氾紝杩樻湁鎷掔粷鏈嶅姟椋庨櫓锛岀户缁窡杩�

## [1.4.0] - 2019-4-20

### Changed
 * 娣诲姞鐩爣璇█閰嶇疆鏋氫妇鎻忚堪
 * 缈昏瘧骞舵浛鎹㈤€夋嫨鍐呭
 * 鍛戒护&閰嶇疆澶氳瑷€鏀寔
    * 鏀寔涓枃&鏃ヨ

### Fixed
 * 鏂囨。鍙樻洿鍚庯紝缂撳瓨娌℃湁娣樻卑

## [1.3.6] - 2019-4-15
### Changed
 * 鎬ц兘浼樺寲锛岀紦瀛樿В鏋愬璞″噺灏戦噸澶嶈绠楋紝鍏抽棴鏂囨。鏃剁Щ闄ょ浉鍏崇紦瀛樺噺灏戝唴瀛樺崰鐢�


## [1.3.5] - 2019-4-14
### Fixed
 * 淇鏈€夋嫨璇█閿欒

## [1.3.2] - 2019-4-14
### Add
 * 鏀寔閰嶇疆缈昏瘧绫诲瀷
    * statusBar鏀寔蹇€熷垏鎹㈢洰鏍囪瑷€閰嶇疆

### Fixed
 * 娉ㄩ噴涓寘鍚玬arkdown鍏朵粬绫诲瀷鏃讹紝涓嶅彲浠ヨ繛缁炕璇�

### Removed
 * 鏂囨湰缈昏瘧, mackdown plaintext缈昏瘧 - 宸叉敮鎸侀€変腑鍐呭缈昏瘧锛屾敼闇€姹傚彇娑�

## [1.3.1] - 2019-4-14
### Add
 * 閫夋嫨鍖哄煙缈昏瘧
   * hover鍒伴€夋嫨鍖哄煙鏃讹紝缈昏瘧璇ュ尯鍩熷唴瀹�

## [1.3.0] - 2019-4-14
### Changed
 * 閲嶆瀯 comment 缈昏瘧锛屼娇鐢ㄤ笌鍙橀噺鐩稿悓缈昏瘧鏂规硶
 * 鍙橀噺缈昏瘧浼樺寲
    * 鏂板蹇€熼€変腑鏈€鍚庝竴娆＄炕璇戝尯鍩熷懡浠�
        * 榛樿鍛戒护 ctrl + shift + s
### Fixed
 * 淇瀛楃涓蹭腑鍖呭惈杞箟绗︾殑 \n \' \"
 * server寮傚父鏃讹紝鍙嶅寮瑰嚭鏃ュ織
 * Object琛ㄨ揪寮忔敮鎸�

## [1.2.0] - 2019-4-10
### Added
 * 瀛楃涓蹭笌鍙橀噺缈昏瘧
    * 缈昏瘧绫诲瀷
        * 瀛楃涓插唴瀹圭炕璇�
        * 鍙橀噺銆佸嚱鏁般€乮nterface绛夊悕绉扮炕璇�
        * support 璇█榛樿鏀寔lib缈昏瘧 
    * 鏀寔椹煎嘲鎷嗗垎

## [1.1.0] - 2019-4-4
### fixed
* google鏈嶅姟鍣ㄥけ璐ワ紙娴侀噺寮傚父锛�
    * 鎻愮ず閿欒锛屼繚鐣橤oogle 缈昏瘧蹇嵎閾炬帴
    * 浣跨敤token鐗堢炕璇戞柟娉�
    * 缃戠粶璇锋眰澶辫触鍚庯紝5鍒嗛挓鍐咃紝涓嶅啀鍙戣捣璇锋眰

### Changed
 * 鑷姩璇嗗埆VSCode鏄剧ず璇█锛屼綔涓洪粯璁� targetLanguage

 
## [1.0.0] - 2018-10-23
### Added 
 * 瀹屾垚鍩虹鍔熻兘
 * 鏀寔鍗曡锛屽琛岀炕璇戞敞閲�
 * 鏀寔澶氳瑷€鍒囨崲
 * 鏀寔鑻辨枃澶氳鍚堝苟缈昏瘧

### Fixed
 * window銆乴inux 渚濊禆vscode-text閿欒锛屽垏鎹㈠埌vsocde鑷甫鐗堟湰 
