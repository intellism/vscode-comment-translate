import { BaseTranslate, ITranslateOptions } from './translate';
const translate = require('baidu-translate-api-temp');

export class BaiduTranslate extends BaseTranslate {
    private _requestErrorTime: number = 0;
    async _request(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        let res = await translate(content, {
            from:this._langMap(from), 
            to:this._langMap(to)
        });
        // console.log(res);
        return res.trans_result.dst;
    }

    _langMap( src:string ){
        let langMaps:Map<string,string> = new Map([
            ['zh-CN','zh'],
            ['zh-TW','cht'],
            ['ko','kor'],
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

        // https://fanyi.baidu.com/#auto/en/%E4%B8%AD%E5%9B%BD
        let str = `https://fanyi.baidu.com/#auto/${this._langMap(to)}/${encodeURIComponent(content)}`;
        return `[Baidu](${str})`;
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
                `[Baidu Translate]:\n${content}\n[<============================>]:\n${result}\n`
            );
        } catch (e) {
            this._requestErrorTime = Date.now();
            this._onTranslate.fire(
                `[Baidu Translate]: request error\n ${JSON.stringify(e)} \n`
            );
        }
        return result;
    }
}
