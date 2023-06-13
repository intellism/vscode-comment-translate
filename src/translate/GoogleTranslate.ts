import { BaseTranslate } from './baseTranslate';
import got from 'got';
import { ITranslateOptions,encodeMarkdownUriComponent } from 'comment-translate-manager';
import { getConfig } from '../configuration';
const querystring = require('querystring');
const GoogleToken: IGetToken = require('@vitalets/google-translate-token');
interface IGetToken {
    get(text: string, opts: {
        tld?: string
    }): Promise<{
        name: string,
        value: string
    }>;
}


export class GoogleTranslate extends BaseTranslate {
    override readonly maxLen= 500;
    async _translate(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        let tld = getConfig<string>('googleTranslate.tld', 'com');
        let token = await GoogleToken.get(content, { tld });
        let url = 'https://translate.google.' + tld + '/translate_a/single';
        let mirror = getConfig<string>('googleTranslate.mirror', '');
        if (mirror !== "") {
            url = mirror + '/translate_a/single';
        }
        let data: any = {
            client: 'gtx',
            sl: from,
            tl: to,
            hl: to,
            dt: ['at', 'bd', 'ex', 'ld', 'md', 'qca', 'rw', 'rm', 'ss', 't'],
            ie: 'UTF-8',
            oe: 'UTF-8',
            otf: 1,
            ssel: 0,
            tsel: 0,
            kc: 7,
            q: content
        };
        data[token.name] = token.value;
        url = url + '?' + querystring.stringify(data);
        let res:any = await got(url, {
            timeout: {request:10000}, headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36'
            }
        }).json();

        let sentences = res[0];
        if (!sentences || !(sentences instanceof Array)) {
            return '';
        }
        let result = sentences
            .map(([trans]) => {
                if (trans) {
                    return trans.replace(/((\/|\*|-) )/g, '$2');
                }
            })
            .join('');
        return result;
    }

    link(content: string, { to = 'auto' }: ITranslateOptions): string {
        // [fix] 参数变化zh-cn -> zh-CN。
        // let [first, last] = to.split('-');
        // if (last) {
        //     last = last.toLocaleUpperCase();
        //     to = `${first}-${last}`;
        // }
        let tld = getConfig<string>('googleTranslate.tld', 'com');
        let str = `https://translate.google.${tld}/#view=home&op=translate&sl=auto&tl=${to}&text=${encodeMarkdownUriComponent(content)}`;
        let mirror = getConfig<string>('googleTranslate.mirror', '');
        if (mirror !== "") {
            str = `${mirror}/#view=home&op=translate&sl=auto&tl=${to}&text=${encodeMarkdownUriComponent(content)}`;
        }
        return `[Google](${str})`;
        // return `<a href="${encodeURI(str)}">Google</a>`;
    }
}
