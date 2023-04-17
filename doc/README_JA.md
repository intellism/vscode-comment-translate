# VSCode 注釈翻訳

## 前書き
[【English】](./README.md) [【中文文档】](../README.md) [【한국어】](./README_KR.md)

多くの優れたプロジェクトには多くのアノテーションがあり、ユーザーはコードの意図をすばやく理解することができます。 しかし、ユーザが注釈付き言語に精通していないと、理解が困難になります。 このプラグインは、Google Translate APIを使用してVSCodeプログラミング言語のコメントを翻訳します。


## v1.5.0 更新
* baiduとbingの翻訳ソースを追加します。同じIPGoogleでの翻訳が多すぎるとアクセスが制限され、一時的に他の翻訳ソースに切り替えることができます。
* 翻訳のターゲット言語オプションを増やす [Google Language support](https://cloud.google.com/translate/docs/languages)
* 「翻訳の置き換え」、翻訳の対象言語を選択し、ショートカットキーを追加します control + shift + t

## 特徴
1. 読むことを妨げることなくコードのコメント部分を特定する。 さまざまな言語、1行、複数行のコメントをサポートします
![Introduction](./image/ja/Introduction.gif)

2. ハンプ分割をサポートするためのユーザー文字列と変数変換のサポート
![Introduction](./image/cn/variable.gif)

3. 最後の翻訳エリアを選択
![Introduction](./image/cn/select.gif)

4. 選択の翻訳と置換
![Introduction](./image/translate-selections.gif)

5. 選択範囲翻訳
![Introduction](./image/cn/selection.gif)

## 設定オプション
#### 多言語サポート
ターゲット言語をすばやく設定するためのステータスバー [Google Language support](https://cloud.google.com/translate/docs/languages)
![Multi-language](./image/cn/status-bar.gif)


#### 複数行のコメントをマージする（ソース言語は英語のみサポート）
![Multi-line-merge](./image/multi-line-merge.gif)
