# VSCode 주석 번역기

[![](https://vsmarketplacebadge.apphb.com/version-short/intellsmi.comment-translate.svg)](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate)
[![](https://vsmarketplacebadge.apphb.com/downloads-short/intellsmi.comment-translate.svg)](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate)
[![](https://vsmarketplacebadge.apphb.com/rating-short/intellsmi.comment-translate.svg)](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate)
[![Licence](https://img.shields.io/github/license/intellism/vscode-comment-translate.svg)](https://github.com/intellism/vscode-comment-translate)

## 소개

[【English】](./doc/README.md) [【中文文档】](../README.md) [【日本語の文書】](./doc/README_JA.md)

많은 우수한 프로젝트들은 많은 주석으로 코드의 의도를 빠르게 이해할 수 있게 합니다. 그러나 주석이 작성된 언어를 잘 모르는 사용자는 이를 이해하는 데 어려움을 겪을 수 있습니다. 
해당 플러그인은 Google, Bing, Baidu, AliCloud, DeepL 등의 API를 활용하여 VSCode 환경에서 프로그래밍 언어의 주석을 번역하는 기능을 제공합니다.

![소개](./doc/image/Introduction.gif)

## 기능
1. 호버는 주석이 달린 코드 영역을 인식하고 번역합니다. 다양한 언어, 한 줄 및 여러 줄 주석을 지원합니다.
2. 호버는 선택한 영역 텍스트가 번역됩니다. (단어 번역)
3. 선택한 텍스트를 번역하고 변경합니다.
4. 파일의 모든 '문자열' 또는 '주석'을 번역하고 변경합니다.
   * 선택된 텍스트 영역이 있는 경우 선택된 영역을 대체하는 "문자열" 또는 "주석"만 인식하고 번역합니다.
5. 호버된 콘텐츠 번역하기 (실험 기능)

## 구성
* `commentTranslate.hover.enabled`: 호버 번역 On/Off（상태 표시줄 통해 빠르게 설정 가능）
* `commentTranslate.hover.concise`: 간결한 모드. 켜진 경우 Ctrl 또는 Command 만 누르면 부동 변환이 트리거 On/Off
* `commentTranslate.hover.string`: 호버 했을때 문자열 번역 On/Off
* `commentTranslate.hover.content`: 호버 콘텐츠 번역 On/Off
* `commentTranslate.multilineMerge`: 여러 줄 병합 주석 달기
* `commentTranslate.targetLanguage`: 번역 대상 언어는 설정되지 않은 경우 VSCode의 로컬 언어를 사용합니다.（상태 표시줄 통해 빠르게 설정 가능）
* `commentTranslate.source`:번역 서비스 소스 구성. 명령을 통해 설정을 완료하는 것이 좋습니다. 번역 서비스 소스에 대한 플러그인 확장을 지원합니다. [example](https://github.com/intellism/deepl-translate)

## 번역 소스
* 외부 "번역 소스" 확장이 지원됩니다. 현재 지원되는 외부 플러그인은 다음과 같습니다. [ChatGPT](https://marketplace.visualstudio.com/items?itemName=kitiho.chatgpt-comment-translate) & [DeepL](https://marketplace.visualstudio.com/items?itemName=intellsmi.deepl-translate) & [tencent cloud](https://marketplace.visualstudio.com/items?itemName=Kaiqun.tencent-cloud-translate)
* 알리바바 AI 번역 소스가 내장되어 있습니다. [알리바바 AI 번역](https://www.aliyun.com/product/ai/alimt)을 사용하여 accessKeyId 및 accessKeySecret을 생성하고 플러그인에서 설정할 수 있습니다. 더 안정적인 번역 서비스를 위해서는 해당 번역 소스로 전환하는 것이 좋습니다
