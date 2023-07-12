

import * as RPCClient from '@alicloud/pop-core';
import { workspace } from 'vscode';
import { ITranslate, ITranslateOptions,encodeMarkdownUriComponent } from 'comment-translate-manager';

const PREFIXCONFIG = 'commentTranslate.translationAli';
const PARAMS = {
    "RegionId": "cn-hangzhou",
    "FormatType": "text",
    "Scene": "general"
};

const LANGS = [
    'ab',
'sq',
'ak',
'ar',
'an',
'am',
'as',
'az',
'ast',
'nch',
'ee',
'ay',
'ga',
'et',
'oj',
'oc',
'or',
'om',
'os',
'tpi',
'ba',
'eu',
'be',
'ber',
'bm',
'pag',
'bg',
'se',
'bem',
'byn',
'bi',
'bal',
'is',
'pl',
'bs',
'fa',
'bho',
'br',
'ch',
'cbk',
'cv',
'ts',
'tt',
'da',
'shn',
'tet',
'de',
'nds',
'sco',
'dv',
'kdx',
'dtp',
'ru',
'fo',
'fr',
'sa',
'fil',
'fj',
'fi',
'fur',
'fvr',
'kg',
'km',
'ngu',
'kl',
'ka',
'gos',
'gu',
'gn',
'kk',
'ht',
'ko',
'ha',
'nl',
'cnr',
'hup',
'gil',
'rn',
'quc',
'ky',
'gl',
'ca',
'cs',
'kab',
'kn',
'kr',
'csb',
'kha',
'kw',
'xh',
'co',
'mus',
'crh',
'tlh',
'hbs',
'qu',
'ks',
'ku',
'la',
'ltg',
'lv',
'lo',
'lt',
'li',
'ln',
'lg',
'lb',
'rue',
'rw',
'ro',
'rm',
'rom',
'jbo',
'mg',
'gv',
'mt',
'mr',
'ml',
'ms',
'chm',
'mk',
'mh',
'kek',
'mai',
'mfe',
'mi',
'mn',
'bn',
'my',
'hmn',
'umb',
'nv',
'af',
'ne',
'niu',
'no',
'pmn',
'pap',
'pa',
'pt',
'ps',
'ny',
'tw',
'chr',
'ja',
'sv',
'sm',
'sg',
'si',
'hsb',
'eo',
'sl',
'sw',
'so',
'sk',
'tl',
'tg',
'ty',
'te',
'ta',
'th',
'to',
'toi',
'ti',
'tvl',
'tyv',
'tr',
'tk',
'wa',
'war',
'cy',
've',
'vo',
'wo',
'udm',
'ur',
'uz',
'es',
'ie',
'fy',
'szl',
'he',
'hil',
'haw',
'el',
'lfn',
'sd',
'hu',
'sn',
'ceb',
'syr',
'su',
'hy',
'ace',
'iba',
'ig',
'io',
'ilo',
'iu',
'it',
'yi',
'ia',
'hi',
'id',
'inh',
'en',
'yo',
'vi',
'zza',
'jv',
'zh',
'zh-tw',
'yue',
'zu',
];

const requestOption = {
    method: 'POST'
};

interface IParam {
    SourceLanguage:string;
    TargetLanguage:string;
    SourceText: string;
}

const langMaps:Map<string,string> = new Map([
    ['zh-CN','zh'],
    ['zh-TW','zh-tw'],
]);

function convertLang( src:string ){
    if(langMaps.has(src)) {
        return langMaps.get(src) || '';
    }
    return src;
}

export function getConfig<T>(key:string):T | undefined {
    let configuration = workspace.getConfiguration(PREFIXCONFIG);
    return configuration.get<T>(key);
}

export class AliTranslate implements ITranslate {
    private _client: RPCClient | null = null;
    readonly maxLen=1000;
    constructor() {
        this.createClient();
        workspace.onDidChangeConfiguration(async eventNames => {
            if (eventNames.affectsConfiguration(PREFIXCONFIG)) {
                this.createClient();
            }
        });
    }

    createClient() {
        let accessKeyId = getConfig<string>('accessKeyId');
        let accessKeySecret= getConfig<string>('accessKeySecret');
        if(!accessKeyId || !accessKeySecret) {
            console.error('Please check the configuration of accesskeyid and accesskeysecret! ');
            return null;
        }
        this._client = new RPCClient({
            accessKeyId,
            accessKeySecret,
            endpoint: 'https://mt.cn-hangzhou.aliyuncs.com',
            apiVersion: '2018-10-12'
        });
        return this._client;
    }

    async translate(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions) {
        
        return this._translate({
            SourceText:content,
            TargetLanguage:convertLang(to),
            SourceLanguage:convertLang(from)
        });
    }

    async _translate(params:IParam) {
        if(!this._client) {
            throw new Error('Client was not initialized successfully! Please check the configuration of accesskeyid and accesskeysecret!');
        }

        let result = await this._client.request<{code:number,Data:{Translated:string}}>('TranslateGeneral', Object.assign({},params,PARAMS), requestOption);
        return result.Data.Translated;
    }

    link(content: string, {  to = 'auto', from = 'auto' }: ITranslateOptions) {
        let str = `https://cn.bing.com/translator/?text=${encodeMarkdownUriComponent(content)}&from=${convertLang(from)}&to=${convertLang(to)}`;
        return `[AliCloud](${str})`;
    }

    isSupported(src:string) {
        const found = LANGS.find(item => item === convertLang(src));
        return found?true:false;
    }
}


