import { BaseTranslate } from './baseTranslate';
import { ITranslateOptions } from 'comment-translate-manager';
import * as CryptoJS from 'crypto-js';
import got from 'got';
import { getConfig } from '../configuration';

const langMaps:Map<string,string> = new Map([
    ['zh-CN','zh'],
    ['zh-TW','cht'],
    ['ko','kor'],
    ['ja','jp'],
    ['fr','fra'],
    ['fr','fra'],
    ['es','spa'],
    ['es','ara'],
    ['bg','bul'],
    ['et','est'],
    ['da','dan'],
    ['fi','fin'],
    ['ro','rom'],
    ['sl','slo'],
    ['sv','swe'],
    ['vi','vie'],
]);

function convertLang( src:string ){
    if(langMaps.has(src)) {
        return langMaps.get(src);
    }
    return src;
}

export class BaiduTranslate extends BaseTranslate {
    override readonly maxLen= 500;
    async _translate(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        let appid = getConfig<string>('baiduTranslate.appid');
        let key = getConfig<string>('baiduTranslate.key');
        const salt: string = Math.floor(Date.now() / 1000).toString();
        const final_sign: string = `${appid}${content}${salt}${key}`;
        const md5Hash: string = CryptoJS.MD5(final_sign).toString(CryptoJS.enc.Hex);
        const api_url: string = 'https://api.fanyi.baidu.com/api/trans/vip/translate';
        const params = {
            q: content,
            from: `${convertLang(from)}`,
            to: `${convertLang(to)}`,
            appid: `${appid}`,
            salt: `${salt}`,
            sign: `${md5Hash}`,
        };
        const response = await got.get(api_url, { searchParams: params });
        const json_reads = JSON.parse(response.body);
        return json_reads.trans_result[0].dst;
    }

    link(content: string, { to = 'auto', from='auto' }: ITranslateOptions): string {
        let str = `https://fanyi.baidu.com/#${convertLang(from)}/${convertLang(to)}/${encodeURIComponent(content)}`;
        return `[Baidu](${str})`;
    }

    static isSupported() {
        // const found = LANGS.find(item => item === convertLang(src));
        // return new Boolean(found);
        return true;
    }
}
