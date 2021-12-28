import { Extension, extensions } from "vscode";
import { ITranslate } from "./translate";
import { Translator } from "./Translator";

// async function changeTranslation(name:string, extensionName:string) {
//     if(extensionName) {
//         let extension = translator.getExtension(extensionName);
//         let fn = await extension.active();
//         fn(registry);
//     }
// }

// 注册插件
function registry(name: string, Translator: new () => ITranslate) {

}

interface ITranslationExtensionConfig {
    extensionId: string
    title: string,
    category?: string,
    translation: string
}

export class TranslationExtensionProvider{

    static getCurrentContributions() {
        const currentContributions = extensions.all.filter(({ packageJSON = {} }) => {
            const { contributes = {} } = packageJSON;
            const { translations } = contributes;
            return translations && translations.length > 0;
        });
        return currentContributions;
    }

    private _registryConfig(conf:ITranslationExtensionConfig) {
        const {extensionId,translation} =conf;
        const key = `${extensionId}-${translation}`;
        this._translatorConfig.set(key,conf);
    }


    
    private _translatorConfig: Map<string, ITranslationExtensionConfig> = new Map();

    constructor(private _translator:Translator) {
        this.buildInRegiste();
        this.loadExtensionTranslator();
    }

    getAllTransationConfig() {
        return this._translatorConfig.entries();
    }

    async loadExtensionTranslator() {
        let currentContributions = TranslationExtensionProvider.getCurrentContributions();

        currentContributions.forEach(extension=>{
            let translations = extension.packageJSON.contributes.translations;
            for(let translation of translations) {
                this._registryConfig({
                    extensionId:extension.id,
                    translation: translation.translation,
                    title: translation.title,
                    category:translation.category
                });
            }
        });
    }

    showError(msg:string) {
        console.log(msg);
    }

    async selectTranslation(id:string) {
        
        const conf = this._translatorConfig.get(id);
        if(!conf) return this.showError(`${id} configuration not found.`)
        if(conf.extensionId !== 'BuildIn') {
            // 激活插件
            let extension = extensions.all.find((extension)=>extension.id === conf.extensionId);
            // console.log('extension');
            await extension.activate();
            // 执行插入点
            if (extension.exports && extension.exports.extendTranslation) {
                let that = this;
                await extension.exports.extendTranslation(function(translation:string, Translator: new () => ITranslate){
                    // 插入translator
                    const key = `${conf.extensionId}-${translation}`;
                    that._translator.registry(key, Translator);
                });
            }
        }

        if(this._translator.hasSource(id)) {
            this._translator.setSource(id);
            return null;
        }
    }

    buildInRegiste() {
        this._registryConfig({
            extensionId:'BuildIn',
            title:'Google translate',
            translation:'Google'
        });

        this._registryConfig({
            extensionId:'BuildIn',
            title:'Baidu translate',
            translation:'Baidu'
        });

        this._registryConfig({
            extensionId:'BuildIn',
            title:'Bing translate',
            translation:'Bing'
        });
    }
}