import { GoogleTranslate } from "./GoogleTranslate";
import { BingTranslate } from "./BingTranslate";
import { BaiduTranslate } from "./BaiduTranslate";

import { Emitter } from "vscode-languageserver"; 
import { getConfig } from "../server";
import { ITranslate, ITranslateOptions } from "./translate";

export class TranslateCreator {

    private _translator: ITranslate;
    protected _onTranslate = new Emitter<string>();
    private _registry:Map<string, new()=>ITranslate> = new Map();
    private _source:string = '';
    
    constructor() {
        this._registry.set('Bing', BingTranslate);
        this._registry.set('Baidu', BaiduTranslate);
        this._registry.set('Google', GoogleTranslate);
        this._translator = this._createTranslator(); 
    }

    get translator() {
        this._createTranslator();
        return this._translator;
    }

    _createTranslator() {
        let {source} = getConfig();
        if(source===this._source) return this._translator;
        this._source = source;

        let ctor = this._registry.get(source);
        if(!ctor) return this._translator;
        this._translator = new ctor();
        this._translator.onTranslate((str)=>this._onTranslate.fire(str));
        return this._translator;
    }

    get onTranslate() {
        return this._onTranslate.event;
    }

    registry(title:string, ctor:new()=>ITranslate) {
        this._registry.set(title,ctor);
        return this._registry.keys();
    }

    async translate(text: string,opts?:ITranslateOptions) {
        return await this._translator.translate(text, opts||{ to: getConfig().targetLanguage });
    }

    link(text: string) {
        return this._translator.link(text, { to: getConfig().targetLanguage });
    }
    
}
