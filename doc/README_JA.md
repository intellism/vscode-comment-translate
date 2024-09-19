# VSCode コメント翻訳プラグイン

このプラグインは、開発者がコード内のコメント、文字列、コードヒント、エラーメッセージ、変数名などの内容を翻訳するのを支援します。

![Licence](https://img.shields.io/github/license/intellism/vscode-comment-translate.svg)

## 紹介
[【English】](../README.md) [【中文文档】](./README_ZH.md) [【한국어】](./README_KR.md)

多くの優れたプロジェクトには豊富なコメントがあり、ユーザーがコードの意図を迅速に理解するのに役立ちます。ユーザーがコメントの言語に慣れていない場合、理解が難しくなります。このプラグインは多くの翻訳シナリオを提供し、開発者が多言語コードをより簡単に理解し、作成するのを支援します。プラグインはGoogle、Bing、AliCloud、DeepLなどの一般的な翻訳サービスをサポートし、開発者がカスタム翻訳サービスを追加することもできます。

![Introduction](./image/Introduction.gif)

## 機能

### コードリーディング
プラグインはTextMateを使用してソースコード内のコメント、文字列などの多言語コンテンツを識別し、迅速に翻訳してHoverで表示し、開発への干渉を最小限に抑えます。

**Hover翻訳**: コメント、文字列、または選択範囲にマウスを移動すると、翻訳された内容がホバーで表示されます。他のホバーコンテンツ（例外、コードドキュメントなど）がある場合も翻訳されて表示されます。

**没入型リーディング**: 没入型コメント翻訳をオンにすると、コメントが自動的に翻訳され、ドキュメントに表示されます。翻訳結果を原文と対照して表示するか、プレースホルダーとして表示するかを設定やショートカットキー`Ctrl+Shift+B`で切り替えることができます。
![Immersive](./image/Immersive.gif)

### 翻訳と置換
プラグインはソースコード内の内容を翻訳するだけでなく、翻訳された内容をドキュメントに迅速に置換することもサポートします。例えば、説明を翻訳して変数名として使用する場合や、多言語開発シナリオで文字列を翻訳してドキュメントに置換する場合などです。

**変数命名の翻訳**：現在の説明を英語に翻訳し、さまざまな変数名を提供します。選択すると元の説明が置換されます。
![naming](<./image/full naming.gif>)

**Hover置換**: ホバー表示された翻訳ボックスで置換機能を提供し、選択すると翻訳結果が元の内容に置換されます。
![hover](./image/hover_image.png)

**全文置換翻訳**：文字列、コメント、選択範囲をサポートし、ワンクリックで全文を翻訳テキストに置換します。
![replace](./image/replace.png)

### GitHub Copilot Chat Participant: @translate
  > - 事前にGitHub Copilot Chatプラグインをインストールし、その認可を受ける必要があります。
  > - GitHub Copilotユーザー向けに、現在はChatボックス内での翻訳をサポートしており、コメントやテキストなどの内容の翻訳にはこの機能を使用できません。

このプラグインはGitHub Copilotを拡張し、Chatボックス内で`@translate`を使用して翻訳を行うことができます。Copilotが提供するAI大モデルを使用してテキストを翻訳し、翻訳先の言語はCommentTranslateの設定されたターゲット言語になります。エディター内でテキストを選択した後、コマンドを使用して迅速にGitHub Copilot Chatに送信して翻訳することができます。
![copilot](./image/copilot.gif)

## 有用なコマンド

> Mac: `ctrl+shift+?` / Windows: `alt+shift+?`

プラグインはさまざまなシナリオの翻訳や置換コマンドを提供しており、一部の一般的な機能にはショートカットキーが設定されています。ユーザーは自分の習慣に応じてショートカットキーをカスタマイズすることもできます。
- **没入型コメント翻訳**：現在のドキュメントの没入型翻訳リーディングをオン/オフ `ctrl+shift+z`
- **没入型表示方法**：対照/プレースホルダーリーディング方法を切り替え `ctrl+shift+b`
- **変数命名の翻訳**：現在の説明語を翻訳して変数名を提供 `ctrl+shift+n`
- **翻訳置換**：選択した内容を翻訳して現在の位置に置換 `ctrl+shift+t`
- **Copilot クイック翻訳**：選択した内容またはクリップボードをGitHub Copilot Chatで翻訳 `ctrl+shift+y`

## 翻訳サービス

このプラグインは以下の翻訳サービスをサポートしています：
- **Google 翻訳**: 内蔵、無料版。 デフォルトで使用
  - **注**：ネットワーク要件があり、一部のユーザーはプロキシが必要です。ネットワークの問題が発生した場合は、Bingの使用をお勧めします。
- **Bing 翻訳**: 内蔵、無料版。
- **AliCloud 翻訳**: 内蔵、accessKeyId & accessKeySecretの設定が必要です。
  
サードパーティが提供する翻訳サービスは、プラグインマーケットで`@tag:translateSource`を検索して見つけることができます。ユーザーはプラグイン設定を通じて使用する翻訳サービスを選択するか、カスタム翻訳サービスを拡張することができます。 [詳細リンク](https://github.com/intellism/vscode-comment-translate/wiki/Translation-Service)

## 一般的な設定
* `commentTranslate.hover.enabled`: ホバー翻訳のオン/オフ（ステータスで迅速に設定可能）
* `commentTranslate.hover.concise`: 簡潔モードのオン/オフ。オンにすると、ctrlまたはcommandを押したときにのみホバー翻訳がトリガーされます。
* `commentTranslate.hover.string`: 文字列ホバー翻訳のオン/オフ
* `commentTranslate.hover.content`: 翻訳ホバーコンテンツのオン/オフ
* `commentTranslate.multilineMerge`: 複数行コメントのマージ
* `commentTranslate.targetLanguage`: 翻訳ターゲット言語。設定がない場合はvscodeのローカル言語を使用します。（ステータスで迅速に設定可能）
* `commentTranslate.source`: 翻訳サービスソースの設定。コマンドを通じて設定することをお勧めします。 プラグイン拡張翻訳サービスソースをサポートします。 [例](https://github.com/intellism/deepl-translate)
* `commentTranslate.maxTranslationLength`: 最大翻訳長の設定。過長文字列の翻訳による過剰な料金を回避します。
* `commentTranslate.browse.enabled`: プロジェクト没入ブラウズ翻訳機能のオン/オフ

## サポート

このプラグインが役に立ったと思ったら、以下の方法でサポートを検討してください：
- GitHubでスターを付ける [intellism/vscode-comment-translate](https://github.com/intellism/vscode-comment-translate)
- フィードバックや提案を送る
- 友人や同僚にシェアする
