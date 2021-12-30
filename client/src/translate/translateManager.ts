import { EventEmitter, Memento } from "vscode";

export interface ITranslate {
    translate(content: string, options: ITranslateOptions): Promise<string>;
    link(content: string, options: ITranslateOptions): string;
    isSupported?: (src: string) => boolean;
}

export interface ITranslateOptions {
    from?: string;
    to: string;
}

export class TranslateManager implements ITranslate {

    private _translate: ITranslate;
    protected _onTranslate = new EventEmitter<string>();
    private _registry: Map<string, new () => ITranslate> = new Map();
    private _source: string = '';
    private _inRequest: Map<string, Promise<string>> = new Map();
    constructor(private _storage: Memento) {
    }

    public get translator() {
        if (!this._translate) {
            throw new Error('Translate not found.');
        }
        return this._translate;
    }

    public hasSource(source) {
        return this._registry.has(source);
    }

    public setSource(source) {
        if (this._source === source) return this._translate;
        this._source = source;
        return this._createTranslate();
    }

    private _createTranslate(): ITranslate | null {
        const ctor = this._registry.get(this._source);
        if (!ctor) return null;
        this._translate = new ctor();
        return this._translate;
    }

    get onTranslate() {
        return this._onTranslate.event;
    }

    public getAllSource() {
        return [...this._registry.keys()];
    }

    public registry(title: string, ctor: new () => ITranslate) {
        this._registry.set(title, ctor);
        return this.getAllSource();
    }

    public async translate(text: string, { to, from = 'auto' }: ITranslateOptions) {

        const key = `${this._source}-from[${from}]to[${to}]-${text}`;
        // 命中本地存储
        const cashe = this._storage.get<string>(key);
        if (cashe) {
            return cashe;
        }
        // 网络请求中
        if (this._inRequest.has(key)) {
            return this._inRequest.get(key);
        }

        try {
            let action = this.translator.translate(text, { from, to });
            this._inRequest.set(key, action);

            const startTranslateTip = `\n[Start translate]:`;
            this._onTranslate.fire(startTranslateTip);
            const translated = await action;
            this._inRequest.delete(key);

            const successTranslateTip = `\n[${this._source}]:\n${text}\n[<============================>]:\n${translated}\n`;
            this._onTranslate.fire(successTranslateTip);
            this._storage.update(key, translated);  // 不用等待持久化成功，直接返回。
            return translated;
        } catch (e) {
            this._inRequest.delete(key);
            const exceptTranslateTip = `\n[${this._source}]: request error:\n ${e.toString()} \n Try again later or change translate source.`;
            this._onTranslate.fire(exceptTranslateTip);
            return '';
        }
    }

    public link(text: string, opts: ITranslateOptions) {
        try {
            return this.translator.link(text, opts);
        } catch (e) {
            this._onTranslate.fire(JSON.stringify(e));
            return '';
        }
    }
}
