import got from 'got';
import { ITranslate, ITranslateOptions } from "comment-translate-manager";

const langMaps: Map<string, string> = new Map([
    ['zh-CN', 'ZH'],
    ['zh-TW', 'ZH'],
]);

function convertLang(src: string | undefined) {
    if (!src) {
        return undefined;
    }
    if (langMaps.has(src)) {
        return langMaps.get(src);
    }
    return src.toLowerCase();
}

// 生成随机的浏览器版本号
function getRandomBrowserVersion() {
    const majorVersion = Math.floor(Math.random() * 17) + 100;
    const minorVersion = Math.floor(Math.random() * 20);
    const patchVersion = Math.floor(Math.random() * 20);
    return `${majorVersion}.${minorVersion}.${patchVersion}`;
}

// 生成随机的操作系统
function getRandomOperatingSystem() {
    const operatingSystems = ["Mac OS", "Windows"];
    const randomIndex = Math.floor(Math.random() * operatingSystems.length);
    return operatingSystems[randomIndex];
}

function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// 构造翻译请求
function constructTranslationRequest(sourceLang: string, textList: string[], targetLang: string) {
    const clientKey = `browser-chrome-${getRandomBrowserVersion()}-${getRandomOperatingSystem()}-${generateUUID()}-${Date.now()}`;

    const translationRequest = {
        header: {
            fn: "auto_translation",
            session: "",
            client_key: clientKey,
            user: "",
        },
        type: "plain",
        model_category: "normal",
        text_domain: "",
        source: {
            lang: sourceLang,
            text_list: textList,
        },
        target: {
            lang: targetLang,
        },
    };

    return translationRequest;
}

export class TranSmartTranslate implements ITranslate {
    async translate(content: string, { from, to }: ITranslateOptions): Promise<string> {
        const translationRequest =
            constructTranslationRequest(from || 'en', content.split('\n'), convertLang(to) || 'zh');

        // 发送 POST 请求
        const url = "https://transmart.qq.com/api/imt";

        const result: any = await got(url, {
            method: 'POST',
            json: translationRequest
        }).json();

        return result.auto_translation.join('\n');
    }

    link(content: string, options: ITranslateOptions): string {
        // Useless, transmart is not compatible
        if (content || options) { }
        return `[TranSmart](https://transmart.qq.com)`;
    }

    isSupported?: ((src: string) => true) | undefined;

    maxLen: number = 5000;
}