import { BaseTranslate } from './baseTranslate';
import { ITranslateOptions } from './translateManager';
const translate = require('baidu-translate-api-temp');

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
        let res = await translate(content, {
            from:convertLang(from), 
            to:convertLang(to)
        });
        return res.trans_result.dst;
    }

    link(content: string, { to = 'auto' }: ITranslateOptions): string {
        let str = `https://fanyi.baidu.com/#auto/${convertLang(to)}/${encodeURIComponent(content)}`;
        return `[Baidu](${str})`;
    }

    static isSupported(src:string) {
        // const found = LANGS.find(item => item === convertLang(src));
        // return new Boolean(found);
        return true;
    }
}
