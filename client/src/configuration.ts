
import { workspace, window } from 'vscode';

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
    ['zh-CN', 'Chinese (Simplified)'],
    ['zh-TW', 'Chinese (Traditional)']
];

export async function changeTargetLanguage() {
    let configuration = workspace.getConfiguration('commentTranslate');
    let res: string = await window.showQuickPick(language.map(item => item[1]), {
        placeHolder: 'Select target language'
    });
    let target = language.find(item => item[1] === res);
    if (target) {
        await configuration.update('targetLanguage', target[0]);
    }
}


export async function showTargetLanguageStatusBarItem(userLanguage: string) {
    let targetBar = window.createStatusBarItem();
    targetBar.command = 'commentTranslate.changeTargetLanguage';
    targetBar.tooltip = 'Comment translate target language. click to change';

    let setLanguageText = async () => {
        let configuration = workspace.getConfiguration('commentTranslate');
        let currentLanguage = await configuration.get('targetLanguage') || userLanguage;
        let current = language.find(item => item[0] === currentLanguage);
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