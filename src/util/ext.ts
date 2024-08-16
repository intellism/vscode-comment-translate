import { promises as fsPromises } from "fs";
import { IGrammarExtensions, ITMLanguageExtensionPoint } from "../syntax/TextMateService";

export async function readResources(extensionPath:string) {
    const resources = await fsPromises.readdir(`${extensionPath}/resources`);
    return Promise.all(resources.filter(v => v !== 'icons').map(async extension => {
        return {
            packageJSON: JSON.parse(await fsPromises.readFile(`${extensionPath}/resources/${extension}/package.json`, 'utf-8')),
            extensionPath: `${extensionPath}/resources/${extension}`
        }
    })); 
}

// 定义新的函数
export function extractGrammarExtensions(inner: { packageJSON: any; extensionPath: string; }[], languageId: number): {grammarExtensions: IGrammarExtensions[]; languageId: number} {
    let grammarExtensions: IGrammarExtensions[] = inner.filter(({ packageJSON }) => {
        return packageJSON.contributes && packageJSON.contributes.grammars;
    }).map(({ packageJSON, extensionPath }) => {
        const contributesLanguages = packageJSON.contributes.languages || [];
        const languages: ITMLanguageExtensionPoint[] = contributesLanguages.map((item: any) => {
            return {
                id: languageId++,
                name: item.id
            }
        });
        return {
            languages,
            value: packageJSON.contributes.grammars,
            extensionLocation:extensionPath
        }
    });

    return {grammarExtensions, languageId};
}