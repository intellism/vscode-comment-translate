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
    // private _activeSource: string = '';
    constructor() {
        // this._registry.set('Bing', BingTranslate);
        // this._registry.set('Baidu', BaiduTranslate);
        // this._registry.set('Google', GoogleTranslate);
        // this.onTranslate((string) => {
        //     connection.console.log(string);
        // });

        // build-in
        this.registry('BuildIn-Bing', BingTranslate);
        this.registry('BuildIn-Baidu', BaiduTranslate);
        this.registry('BuildIn-Google', GoogleTranslate);
        this._translator = new GoogleTranslate();
    }

    public get translator() {
        // this._createTranslator();
        return this._translator;
    }

    public hasSource(source) {
        return this._registry.has(source);
    }

    public setSource(source) {
        if(this._source === source) return;
        this._source = source;
        this._createTranslator();
    }

    private _createTranslator(): ITranslate | null {
        // const source = getConfig<string>('source');
        // if (source === this._source || source === this._activeSource) return null;
        // this._activeSource = source;
        // if(!this.hasSource(source)) {
        //     this._onTranslate.fire(`\nError:"${source}",Is not a valid translation source!\n`);
        //     return null;
        // }
        // this._source = source;

        const ctor = this._registry.get(this._source);
        if (!ctor) return null;
        this._translator = new ctor();
        this._translator.onTranslate((str) => this._onTranslate.fire(str));
    }

    get onTranslate() {
        // 事件不会重新绑定，所以需要重新代理
        return this._onTranslate.event;
    }

    public getAllSource() {
        return [...this._registry.keys()];
    }

    public registry(title: string, ctor: new () => ITranslate) {
        this._registry.set(title, ctor);
        return this.getAllSource();
    }

    public async translate(text: string, opts?: ITranslateOptions) {
        try {
            return await this.translator.translate(text, opts || { to: getConfig<string>('targetLanguage') });
        } catch(e) {
            this._onTranslate.fire(JSON.stringify(e));
            return '';
        }
         
    }

    public link(text: string) {
        try {
            return this.translator.link(text, { to: getConfig<string>('targetLanguage') });
        } catch(e) {
            this._onTranslate.fire(JSON.stringify(e));
            return '';
        }
    }

}
