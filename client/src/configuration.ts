
import { workspace, window, QuickPickItem } from 'vscode';

// TODO 临时仅支持这部分语言
const language: [string, string][] = [
    ['de', 'German'],
    ['es', 'Spanish'],
    ['en', 'English'],
    ['fr', 'French'],
    ['it', 'Italian'],
    ['ja', 'Japanese'],
    ['ko', 'Korean'],
    ['ru', 'Russian'],
    ['pl', 'Polish'],
    ['zh-CN', 'Chinese (Simplified)'],
    ['zh-TW', 'Chinese (Traditional)']
];
let defualtLanguage:string;
export async function selectTargetLanguage(placeHolder:string = 'Select target language') {

    let items:QuickPickItem[] = language.map(item=>{
        return {
            label: item[1],
            description:item[0],
        };
    });

    if(!defualtLanguage) {
        defualtLanguage = await workspace.getConfiguration('commentTranslate').get<string>('targetLanguage');
    }
    let defaultTarget = language.find(item => item[0] === defualtLanguage);
    defaultTarget&&items.unshift({
        label:defaultTarget[1],
        description:defaultTarget[0],
        detail: 'Default select'
    });
    let res: QuickPickItem = await window.showQuickPick(items, {
        placeHolder
    });
    let target = language.find(item => item[1] === res.label);
    
    defualtLanguage = target[0];
    return target[0];
}


export async function showTargetLanguageStatusBarItem(userLanguage: string) {
    let targetBar = window.createStatusBarItem();
    targetBar.command = 'commentTranslate.changeTargetLanguage';
    targetBar.tooltip = 'Comment translate target language. click to change';

    let setLanguageText = async () => {
        let configuration = workspace.getConfiguration('commentTranslate');
        let currentLanguage: string = (await configuration.get<string>('targetLanguage')) || userLanguage;
        let current = language.find(item => item[0].toLowerCase() === currentLanguage.toLowerCase());
        if (current) {
            targetBar.text = '$(globe) ' + current[1];
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
