import { promises as fsPromises } from "fs";
import { IGrammarExtensions, ITMLanguageExtensionPoint } from "../syntax/TextMateService";
import { commands, env, extensions } from "vscode";
import { ctx } from "../extension";

export async function readResources(extensionPath: string) {
    const resources = await fsPromises.readdir(`${extensionPath}/resources`);
    return Promise.all(resources.filter(v => v !== 'icons').map(async extension => {
        return {
            packageJSON: JSON.parse(await fsPromises.readFile(`${extensionPath}/resources/${extension}/package.json`, 'utf-8')),
            extensionPath: `${extensionPath}/resources/${extension}`
        }
    }));
}

// 定义新的函数
export function extractGrammarExtensions(inner: { packageJSON: any; extensionPath: string; }[], languageId: number): { grammarExtensions: IGrammarExtensions[]; languageId: number } {
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
            extensionLocation: extensionPath
        }
    });

    return { grammarExtensions, languageId };
}


export async function getGrammerExtensions() {
    let { grammarExtensions, languageId } = extractGrammarExtensions([...extensions.all], 2);
    // 如果为远程环境，使用插件内置语法
    if (env.remoteName) {
        const inner = await readResources(ctx.extensionPath);
        let { grammarExtensions: innergrammarExtensions } = extractGrammarExtensions(inner, languageId);
        grammarExtensions.push(...innergrammarExtensions);
    }

    return grammarExtensions;
}

/**
 * Languages capable of parsing comments via TextMate
 */
export async function getCanLanguageIds() {
    let grammarExtensions = await getGrammerExtensions();

    let canLanguages: string[] = [];
    canLanguages = grammarExtensions.reduce<string[]>(((prev, item) => {
        let lang: string[] = item.value.map((grammar) => grammar.language).filter(v => v);
        return prev.concat(lang);
    }), canLanguages);


    let BlackLanguage: string[] = ['log', 'Log', 'code-runner-output'];
    canLanguages = canLanguages.filter((v) => BlackLanguage.indexOf(v) < 0);

    commands.executeCommand('setContext', 'commentTranslate.canLanguages', canLanguages);
    return canLanguages;
}
