
import axios from 'axios';
const querystring = require('querystring');

import { workspace } from 'vscode';
import { ITranslate, ITranslateOptions } from 'comment-translate-manager';

const PREFIXCONFIG = 'commentTranslate.deeplTranslate';

const langMaps: Map<string, string> = new Map([
    ['zh-CN', 'ZH'],
    ['zh-TW', 'ZH'],
]);

function convertLang(src: string) {
    if (langMaps.has(src)) {
        return langMaps.get(src);
    }
    return src.toLocaleUpperCase();
}

export function getConfig<T>(key: string): T | undefined {
    let configuration = workspace.getConfiguration(PREFIXCONFIG);
    return configuration.get<T>(key);
}

export type DeepLPreserveFormatting = '0' | '1';
export type DeepLFormality = "default" | "more" | "less";


interface DeepLTranslateOption {
    apiFree: boolean;
    authKey: string;
    preserveFormatting: DeepLPreserveFormatting;
    formality: DeepLFormality;
}
interface Response {
    translations: {
        detected_source_language: string;
        text: string;
    }[];
}

export class DeepLTranslate implements ITranslate {
    get maxLen(): number {
        return 3000;
    }

    private _defaultOption: DeepLTranslateOption;
    constructor() {
        this.createOption();
        workspace.onDidChangeConfiguration(async eventNames => {
            if (eventNames.affectsConfiguration(PREFIXCONFIG)) {
                this.createOption();
            }
        });
    }

    createOption() {
        this._defaultOption = {
            apiFree: getConfig<boolean>('apiFree'),
            authKey: getConfig<string>('authKey'),
            preserveFormatting: getConfig<DeepLPreserveFormatting>('preserveFormatting'),
            formality: getConfig<DeepLFormality>('formality'),
        };
    }

    async translate(content: string, { to = 'auto' }: ITranslateOptions) {

        const subDomain = this._defaultOption.apiFree ? 'api-free' : 'api';
        const url = `https://${subDomain}.deepl.com/v2/translate`;

        if(!this._defaultOption.authKey) {
            throw new Error('Please check the configuration of authKey!')
        }

        const data = {
            text: content,
            target_lang: convertLang(to),
            auth_key: this._defaultOption.authKey,
            preserve_formatting: this._defaultOption.preserveFormatting,
            formality: this._defaultOption.formality
        };

        let res = await axios.post<Response>(url,querystring.stringify(data));

        
        return res.data.translations[0].text;
    }


    link(content: string, { to = 'auto' }: ITranslateOptions) {
        let str = `https://www.deepl.com/translator#auto/${convertLang(to)}/${encodeURIComponent(content)}`;
        return `[DeepL](${str})`;
    }

    isSupported(src: string) {
        return true;
    }
}





