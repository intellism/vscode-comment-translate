import { BaseTranslate, ITranslateOptions } from './translate';
const { translate } = require('bing-translate-api');


//免费API https://github.com/Selection-Translator/translation.js/tree/master/src
export class BingTranslate extends BaseTranslate {
    private _requestErrorTime: number = 0;
    async _request(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        let res = await translate(content, this._langMap(from), this._langMap(to));
        console.log(res);
        return res.translation;
    }

    _langMap( src:string ){
        let langMaps:Map<string,string> = new Map([
            ['auto','auto-detect'],
            ['zh-CN','zh-Hans'],
            ['zh-TW','zh-Hant'],
        ]);

        if(langMaps.has(src)) {
            return langMaps.get(src);
        }
        return src;
    }

    link(content: string, { to = 'auto' }: ITranslateOptions): string {
        // [fix] 参数变化zh-cn -> zh-CN。
        let [first, last] = to.split('-');
        if (last) {
            last = last.toLocaleUpperCase();
            to = `${first}-${last}`;
        }
        let str = `https://translate.google.cn/#view=home&op=translate&sl=auto&tl=${to}&text=${encodeURIComponent(content)}`;
        return `[Google](${encodeURI(str)})`;
        // return `<a href="${encodeURI(str)}">Google</a>`;
    }

    async _translate(content: string, opts: ITranslateOptions): Promise<string> {
        let result = '';
        // 上一次失败的时间间隔小于1分钟，直接返回空
        if (Date.now() - this._requestErrorTime <= 60 * 1000) {
            return result;
        }
        try {
            result = await this._request(content, opts);
            this._onTranslate.fire(
                `[Bing Translate]:\n${content}\n[<============================>]:\n${result}\n`
            );
        } catch (e) {
            this._requestErrorTime = Date.now();
            this._onTranslate.fire(
                `[Bing Translate]: request error\n ${JSON.stringify(e)} \n`
            );
        }
        return result;
    }
}
