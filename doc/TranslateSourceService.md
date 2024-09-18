# 翻译服务

为了保证插件的服务可用性，支持了多种翻译服务，并支持了自定义插件添加翻译服务。用户可以通过插件配置选择需要使用的翻译服务。
[切换复议服务](https://github.com/intellism/deepl-translate/raw/master/image/select.png)

## 内置翻译服务列表
- Google Translate
- Bing Translate
- AliCloud Translate
- DeepL Translate


## 自定义翻译服务
翻译服务众多，特别是各类AI大模型的翻译效果会比传统翻译服务更好，所以我们也支持自定义插件添加翻译服务。开发者可以参考 https://github.com/intellism/deepl-translate,实现自定义的服务。

### 自定义翻译服务示例
1. 创建一个VSCode插件项目, https://code.visualstudio.com/api/get-started/your-first-extension
2. `package.json`申明贡献翻译服务配置。配置Key为`translate`,申明服务名字和标题,配置keywords为`translateSource`,可以被搜索到。
   ```json
    "contributes": {
        "translates": [
            {
                "translate": "deepl",
                "title": "DeepL translate"
            }
        ]
    },
    "keywords": [
        "translateSource",
        "comment translate",
        "deepl",
        "deepl translate",
        "翻译",
        "注释",
        "翻訳"
    ]
   ```
3. 实现翻译服务
    ```typescript
     import { ITranslate, ITranslateOptions } from 'comment-translate-manager';
     export class DeepLTranslate implements ITranslate {

          get maxLen() {
                // 单词请求最大长度限制
                return 5000;
          }
          async translate(content: string, options: ITranslateOptions): Promise<string> {
                // 实现翻译逻辑
          }
          async link(content: string, options: ITranslateOptions): Promise<string> {
                // 实现更多链接逻辑
          }

          
          // ...
     }
    ```
4. 插件入口`extension.ts`,注册服务
    ```typescript
    import { ITranslateRegistry } from 'comment-translate-manager';
    import { DeepLTranslate } from './deepl-translate';
    export function activate(context: vscode.ExtensionContext) {

        //Expose the plug-in
        return {
            extendTranslate: function (registry: ITranslateRegistry) {
                registry('deepl', DeepLTranslate);
            }
        };
    }
    ```
5. 发布插件,分享给更多人使用。





