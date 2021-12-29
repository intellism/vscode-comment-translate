import { ITranslate, ITranslateOptions } from './translateManager';

export abstract class BaseTranslate implements ITranslate {
    constructor() {
    }

    async translate(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        return this._translate(content, { from, to });
    }

    link(content: string, opts: ITranslateOptions): string {
        if (content || opts) { }
        return '';
    }

    isSupported(src: string) {
        return true;
    }

    abstract _translate(content: string, opts: { from?: string, to?: string }): Promise<string>;
}
