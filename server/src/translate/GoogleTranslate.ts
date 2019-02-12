import { BaseTranslate } from './translate';
import request from '../util/request-promise';
//免费API https://github.com/Selection-Translator/translation.js/tree/master/src
export class GoogleTranslate extends BaseTranslate {

    private _timer: number = 0;

    async _request(content: string, { from = 'auto', to = 'auto' }: { from?: string, to?: string }): Promise<string> {
        let url = `https://translate.google.cn/translate_a/single?client=gtx&dt=t&dj=1&ie=UTF-8&sl=${from}&tl=${to}&q=${encodeURIComponent(content)}`;
        let res = await request(url, { json: true, timeout: 10000 });
        if (!res.sentences) {
            return '';
        }
        let result = res.sentences.map((sentence: any) => sentence.trans.replace(/((\/|\*|-) )/g, "$2")).join('');
        return result;
    }

    async _translate(content: string, { from = 'auto', to = 'auto' }: { from?: string, to?: string }): Promise<string> {
        let result = '';
        if (Date.now() - this._timer <= 5 * 60 * 1000) {
            return result;
        }
        try {
            result = await this._request(content, { from, to });
        } catch (e) {
            this._timer = Date.now();
        }
        this._onTranslate.fire(`[Google Translate]:\n${content}\n[<============================>]:\n${result}\n`);
        return result;
    }
}