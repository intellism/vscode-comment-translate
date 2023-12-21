import { BaseTranslate } from './baseTranslate';
import { ITranslateOptions,encodeMarkdownUriComponent } from 'comment-translate-manager';
import { getConfig } from '../configuration';
import { translate } from '@vitalets/google-translate-api';

export class GoogleTranslate extends BaseTranslate {
    override readonly maxLen= 500;
    async _translate(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        let mirror = getConfig<string>('googleTranslate.mirror', '');

        let options = {
            from:`${from}`,
            to:`${to}`
        } as { from: string; to: string; host?: string };
        
        if (mirror !== '') {
            options.host=mirror
        }
        const { text } = await translate(content, options);
        return text;
    }

    link(content: string, { to = 'auto',from='auto' }: ITranslateOptions): string {
        let str = `https://translate.google.com/#view=home&op=translate&sl=${from}&tl=${to}&text=${encodeMarkdownUriComponent(content)}`;
        return `[Google](${str})`;
    }
}
