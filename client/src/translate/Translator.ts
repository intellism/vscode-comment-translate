import { GoogleTranslate } from "./GoogleTranslate";
import { BingTranslate } from "./BingTranslate";
import { BaiduTranslate } from "./BaiduTranslate";

import { EventEmitter } from "vscode";
import { ITranslate, ITranslateOptions } from "./translate";
import { getConfig } from "../configuration";
// workspace.Event
export class Translator implements ITranslate {

    private _translator: ITranslate;
    protected _onTranslate = new EventEmitter<string>();
    private _registry: Map<string, new () => ITranslate> = new Map();
    private _source: string = '';
    constructor() {
        this._registry.set('Bing', BingTranslate);
        this._registry.set('Baidu', BaiduTranslate);
        this._registry.set('Google', GoogleTranslate);
        this._translator = this._createTranslator() || new GoogleTranslate();
        // this.onTranslate((string) => {
        //     connection.console.log(string);
        // });
    }

    get translator() {
        this._createTranslator();
        return this._translator;
    }

    _createTranslator(): ITranslate | null {
        const source = getConfig<string>('source');
        if (source === this._source) return null;
        this._source = source;

        const ctor = this._registry.get(source);
        if (!ctor) return null;
        this._translator = new ctor();
        this._translator.onTranslate((str) => this._onTranslate.fire(str));
        return this._translator;
    }

    get onTranslate() {
        // 事件不会重新绑定，所以需要重新代理
        return this._onTranslate.event;
    }

    registry(title: string, ctor: new () => ITranslate) {
        this._registry.set(title, ctor);
        return this._registry.keys();
    }

    async translate(text: string, opts?: ITranslateOptions) {
        return await this.translator.translate(text, opts || { to: getConfig<string>('targetLanguage') });
    }

    link(text: string) {
        return this.translator.link(text, { to: getConfig<string>('targetLanguage') });
    }

}
