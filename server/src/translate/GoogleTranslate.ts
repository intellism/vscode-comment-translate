import { BaseTranslate } from './translate';
import request from '../util/request-promise';
//免费API https://github.com/Selection-Translator/translation.js/tree/master/src
export class GoogleTranslate extends BaseTranslate {
    async _translate(content: string, { from = 'auto', to = 'auto' }: { from?: string, to?: string }): Promise<string> {
        let url = `https://translate.google.cn/translate_a/single?client=gtx&dt=t&dj=1&ie=UTF-8&sl=${from}&tl=${to}&q=${encodeURIComponent(content)}`;
        let res = await request(url, { json: true, timeout: 10000 });
        if (!res.sentences) {
            throw new Error(res);
        }
        let result = res.sentences.map((sentence: any) => sentence.trans.replace(/((\/|\*|-) )/g, "$2")).join('');
        this._onTranslate.fire(`[Google Translate]:\n${content}\n[<============================>]:\n${result}\n`);
        return result;
    }
}