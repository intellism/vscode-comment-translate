import { BaseTranslate, ITranslateOptions } from './translate';
import request from '../util/request-promise';
//免费API https://github.com/Selection-Translator/translation.js/tree/master/src
export class GoogleTranslate extends BaseTranslate {
    private _requestErrorTime: number = 0;

    async _request(
        content: string,
        { from = 'auto', to = 'auto' }: ITranslateOptions
    ): Promise<string> {
        let url = `https://translate.google.cn/translate_a/single?client=gtx&dt=t&dj=1&ie=UTF-8&sl=${from}&tl=${to}&q=${encodeURIComponent(
            content
        )}`;
        let res = await request(url, { json: true, timeout: 10000 });
        if (!res.sentences || !(res.sentences instanceof Array)) {
            return '';
        }
        let result = res.sentences
            .map((sentence: any) =>
                sentence.trans.replace(/((\/|\*|-) )/g, '$2')
            )
            .join('');
        return result;
    }

    link(
        content: string,
        { to = 'auto' }: ITranslateOptions
    ): string {

        // [fix] 参数变化zh-cn -> zh-CN。
        let [first, last] = to.split('-');
        if (last) {
            last = last.toLocaleUpperCase();
            to = `${first}-${last}`;
        }
        return `[Google](https://translate.google.cn/#view=home&op=translate&sl=auto&tl=${to}&text=${encodeURIComponent(
            encodeURIComponent(content)
        )})`;
    }

    async _translate(
        content: string,
        { from = 'auto', to = 'auto' }: ITranslateOptions
    ): Promise<string> {
        let result = '';
        // 上一次失败的时间间隔小于5分钟，直接返回空
        if (Date.now() - this._requestErrorTime <= 5 * 60 * 1000) {
            return result;
        }
        try {
            result = await this._request(content, { from, to });
            this._onTranslate.fire(
                `[Google Translate]:\n${content}\n[<============================>]:\n${result}\n`
            );
        } catch (e) {
            this._requestErrorTime = Date.now();
            this._onTranslate.fire(
                `[Google Translate]: request error\n ${JSON.stringify(e)}`
            );
        }
        return result;
    }
}
