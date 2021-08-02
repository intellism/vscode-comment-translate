
import { workspace, window, QuickPickItem } from 'vscode';
import { LANGS } from './lang';

// TODO 临时仅支持这部分语言
// const language: [string, string][] = [
//     ['de', 'German'],
//     ['es', 'Spanish'],
//     ['en', 'English'],
//     ['fr', 'French'],
//     ['it', 'Italian'],
//     ['ja', 'Japanese'],
//     ['ko', 'Korean'],
//     ['ru', 'Russian'],
//     ['pl', 'Polish'],
//     ['zh-CN', 'Chinese (Simplified)'],
//     ['zh-TW', 'Chinese (Traditional)']
// ];

let languages = new Map(LANGS);

let defualtLanguage: string;
export async function selectTargetLanguage(placeHolder: string = 'Select target language') {

    let items: QuickPickItem[] = LANGS.map(item => {
        return {
            label: item[1],
            description: item[0],
        };
    });

    if (!defualtLanguage) {
        defualtLanguage = await workspace.getConfiguration('commentTranslate').get<string>('targetLanguage');
    }
    let defaultTarget = languages.get(defualtLanguage);
    defaultTarget && items.unshift({
        label: defaultTarget,
        description: defualtLanguage,
        detail: 'Default select'
    });
    let res: QuickPickItem = await window.showQuickPick(items, {
        placeHolder
    });
    if (res) {
        defualtLanguage = res.description;
        return res.description;
    }
    return null;
}

export async function showTargetLanguageStatusBarItem(userLanguage: string) {
    let targetBar = window.createStatusBarItem();
    targetBar.command = 'commentTranslate.changeTargetLanguage';
    targetBar.tooltip = 'Comment translate target language. click to change';

    let setLanguageText = async () => {
        let configuration = workspace.getConfiguration('commentTranslate');
        let currentLanguage: string = (await configuration.get<string>('targetLanguage')) || userLanguage;
        let current = languages.get(currentLanguage);
        if (current) {
            targetBar.text = '$(globe) ' + current;
        }
    }
    await setLanguageText();
    targetBar.show();
    workspace.onDidChangeConfiguration(async eventNames => {
        if (eventNames.affectsConfiguration('commentTranslate')) {
            await setLanguageText();
        };
    })

    return targetBar;
}
