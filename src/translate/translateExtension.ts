import { extensions } from "vscode";
import { ITranslate, TranslateManager } from "comment-translate-manager";

export interface ITranslateExtensionConfig extends ITranslateConfig {
    extensionId: string;
}

export interface ITranslateConfig {
    title: string;
    category?: string;
    ctor?: new () => ITranslate;
    translate: string;
}

export interface ITranslateRegistry {
    (translation: string, translate: new () => ITranslate): void;
}

export class TranslateExtensionProvider {

    static getCurrentContributions() {
        const currentContributions = extensions.all.filter(({ packageJSON = {} }) => {
            const { contributes = {} } = packageJSON;
            const { translates } = contributes;
            return translates && translates.length > 0;
        });
        return currentContributions;
    }

    private _registryConfig(conf: ITranslateExtensionConfig) {
        const { extensionId, translate: translation } = conf;
        const key = `${extensionId}-${translation}`;
        this._translateConfig.set(key, conf);
    }

    private _registryBuildInConfig(conf: ITranslateExtensionConfig) {
        const { translate: translation } = conf;
        const key = `${translation}`;
        this._translateConfig.set(key, conf);
    }

    private _translateConfig: Map<string, ITranslateExtensionConfig> = new Map();

    constructor(private _translateManager: TranslateManager, buildInTranslate: ITranslateConfig[]) {
        this.buildInTranslation(buildInTranslate);
        this.loadExtensionTranslate();
        extensions.onDidChange(()=>{
            this._translateConfig.clear();
            this.buildInTranslation(buildInTranslate);
            this.loadExtensionTranslate();
        });
    }

    async init(source: string) {
        const success = await this.switchTranslate(source);
        if (!success) {
            const defaulte = await this.switchTranslate('Google');
            return defaulte;
        }
    }

    getAllTransationConfig() {
        return this._translateConfig.entries();
    }

    loadExtensionTranslate() {
        let currentContributions = TranslateExtensionProvider.getCurrentContributions();

        currentContributions.forEach(extension => {
            let translates = extension.packageJSON.contributes.translates;
            for (const {translate,title,category} of translates) {
                if(title && translate) {
                    this._registryConfig({
                        extensionId: extension.id,
                        translate,
                        title,
                        category
                    });
                }
                
            }
        });
    }

    showError(msg: string) {
        console.log(msg);
    }

    async switchTranslate(id: string) {
        if (this._translateManager.hasSource(id)) {
            return this._translateManager.setSource(id);
        }
        // 忽略大小写查找配置
        const conf = Array.from(this._translateConfig.entries())
            .find(([key]) => key.toLowerCase() === id.toLowerCase())?.[1];
        if (!conf) {
            this.showError(`${id} configuration not found.`);
            return null;
        };
        if (conf.extensionId !== 'BuildIn') {
            // 激活插件
            let extension = extensions.all.find((extension) => extension.id === conf.extensionId);
            // console.log('extension');
            if(!extension) return null;
            await extension.activate();
            // 执行插入点
            if (extension.exports && extension.exports.extendTranslate) {
                const registry:ITranslateRegistry = (translation, Translate) => {
                    // 注册翻译器
                    const key = `${conf.extensionId}-${translation}`;
                    this._translateManager.registry(key, Translate);
                };
                await extension.exports.extendTranslate(registry);
            }
        } else if(conf.ctor) {
            // 兼容原有配置，BuildIn的不添加前缀
            id = conf.translate;
            this._translateManager.registry(id, conf.ctor);
        }

        if (this._translateManager.hasSource(id)) {
            return this._translateManager.setSource(id);
        }
    }

    buildInTranslation(buildInTranslate: ITranslateConfig[]) {
        buildInTranslate
        .map(translate => Object.assign({ extensionId: 'BuildIn' }, translate))
        .forEach(translate => this._registryBuildInConfig(translate));
    }
}