import { Emitter } from 'vscode-languageserver';

export interface ITranslateOptions {
    from?: string;
    to?: string;
}

export abstract class BaseTranslate {
    protected _onTranslate = new Emitter<string>();
    private _inRequest: Map<string, Promise<string>> = new Map();
    constructor() {

    }

    get onTranslate() {
        return this._onTranslate.event;
    }

    async translate(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        let key = `from[${from}]to[${to}]-${content}`;
        if (this._inRequest.has(key)) {
            let action = this._inRequest.get(key);
            return await action;
        }
        let action = this._translate(content, { from, to });
        this._inRequest.set(key, action);
        return await action;
    }

    link(content: string, opts: ITranslateOptions): string {
        if (content || opts) { }
        return '';
    }

    abstract _translate(content: string, opts: { from?: string, to?: string }): Promise<string>;
}
