# 翻译服务

为了保证插件的服务可用性，插件支持了多种翻译服务，并支持了自定义插件添加翻译服务。用户可以通过插件配置选择需要使用的翻译服务。
![切换翻译服务](https://github.com/intellism/deepl-translate/raw/master/image/select.png)

## 内置翻译服务列表

|  翻译服务     | 免费服务 |      超出费用     |  使用教程 |
| ----------- | ----------| ----------------- | ----------------- |
| Google Translate | 无限免费 |  - | 内置服务, 部分地区有网络问题,局域网使用过多容易IP限流 |
| Bing Translate | 无限免费 |  - | 内置服务 |
| 腾讯交互翻译 | 无限免费 |  - | 推荐使用，效果和响应都不错。[TranSmart插件](https://marketplace.visualstudio.com/items?itemName=naomi233.comment-translate-transmart) |
| 阿里翻译 | 每月100万字符 |  50元/100万字符	 | 已内置。[点此申请秘钥](https://bobtranslate.com/service/translate/ali.html) |
| DeepL | 每月50万字符 |  每月4.99欧元基础费用 + 20欧元/100万字符	 | [DeepL插件](https://marketplace.visualstudio.com/items?itemName=intellsmi.deepl-translate)、[点此申请秘钥](https://bobtranslate.com/service/translate/deepl.html) |
| 腾讯云 | 每月500万字符 |  58元/100万字符		 | [Tecent Cloud插件](https://marketplace.visualstudio.com/items?itemName=Kaiqun.tencent-cloud-translate) 、[点此申请秘钥](https://cloud.tencent.com/product/tmt) |
| Chatgpt | 无 |  $0.002 / 1K tokens（GPT 3.5）			 |[ChatGPT 支持反代 API](https://marketplace.visualstudio.com/items?itemName=upupnoah.chatgpt-comment-translateX)、[ChatGPT](https://marketplace.visualstudio.com/items?itemName=kitiho.chatgpt-comment-translate)、[点此申请秘钥](https://bobtranslate.com/service/translate/openai.html) |

**注意**: 以上费用仅供参考，具体费用以服务商官网为准。 其他插件提供的翻译服务可以在插件市场搜索`@tag:translateSource`找到。
![image](https://github.com/user-attachments/assets/9cb8d6ea-f0a0-4b11-a9b0-66192dc7f671)


## 自定义扩展翻译服务
翻译服务众多，特别是各类AI大模型的翻译效果会比传统翻译服务更好，所以我们也支持自定义插件添加翻译服务。开发者可以参考[Deepl示例](https://github.com/intellism/deepl-translate),实现自定义的服务。

### 开发一个翻译服务插件

翻译服务插件是将翻译服务暴露给Comment Translate插件。需要实现`ITranslate`接口,并在插件入口注册服务。用户在选择翻译服务时，会显示插件配置的标题和关键字。当用户切换到该插件时，会启动插件并将翻译请求发送给插件。

**注意**: 同一个插件可以贡献多个翻译服务项目，并且已经存在的插件可以贡献翻译服务。

1. **创建插件**:创建一个VSCode插件项目, [文档](https://code.visualstudio.com/api/get-started/your-first-extension)
2. **申明服务**:`package.json`申明贡献翻译服务配置。配置Key为`translates`,申明服务名字和标题,配置keywords为`translateSource`,可以被搜索到。
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
3. **实现翻译服务**: 实现`ITranslate`接口,实现翻译逻辑
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
4. **注册服务**:插件入口`extension.ts`,注册服务
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
5. **调试插件**: 调试运行插件,执行`Change translation source`唤起服务配置页面,选择注册的翻译服务,查看翻译效果。
   ![服务选择](https://github.com/intellism/deepl-translate/raw/master/image/select.png)
6. **发布插件**: 发布插件,分享给更多人使用。[文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)





