
import { workspace, window, QuickPickItem, ThemeIcon, commands } from 'vscode';
import { LANGS } from './lang';

let languages = new Map(LANGS);
let defaultLanguage: string;
export async function selectTargetLanguage(placeHolder: string = 'Select target languageX') {

    let items: QuickPickItem[] = LANGS.map(item => {
        return {
            label: item[1],
            description: item[0],
        };
    });

    if (!defaultLanguage) {
        defaultLanguage = await getConfig<string>('targetLanguage');
    }
    let defaultTarget = languages.get(defaultLanguage);
    defaultTarget && items.unshift({
        label: defaultTarget,
        description: defaultLanguage,
        detail: 'Default select'
    });
    
    let res: QuickPickItem = await new Promise<QuickPickItem|undefined>(
        async(resolve) => {
            let quickPick = window.createQuickPick();
            quickPick.items = items;
            quickPick.placeholder = placeHolder;
            const createButton = async () => {
                let enableHover = await getConfig<boolean>('hover.open');
                let button = {
                    iconPath: new ThemeIcon(enableHover?'eye':'eye-closed'),
                    tooltip: 'Toggle enable hover.'
                };
                quickPick.buttons = [button];

                return button;
            };
            let toggleEnableHoverButton = await createButton();
            quickPick.onDidTriggerButton(async item => {
                if (item === toggleEnableHoverButton) {
                    await commands.executeCommand('commentTranslate.toggleEnableHover');
                    toggleEnableHoverButton = await createButton();
                }
            });
            quickPick.onDidChangeSelection((r)=>{
                if(r.length>0) {
                    quickPick.hide();
                    resolve(r[0]);
                } else {
                    resolve(undefined);
                }
            });
            quickPick.show();
        }
    );
    if (res) {
        defaultLanguage = res.description;
        return res.description;
    }
    return null;
}


export async function showHoverStatusBar(userLanguage: string) {
    let bar = window.createStatusBarItem();
    bar.command = 'commentTranslate.toggleEnableHover';
    bar.tooltip = 'Comment translate toggle enable hover.';

    let setLanguageText = async () => {
        let enableHover = await getConfig<boolean>('hover.open');
        bar.text = `$(${enableHover?'eye':'eye-closed'}) `;
    }
    await setLanguageText();
    bar.show();
    workspace.onDidChangeConfiguration(async eventNames => {
        if (eventNames.affectsConfiguration('commentTranslate')) {
            await setLanguageText();
        };
    });
    return bar;
}
export async function showTargetLanguageStatusBarItem(userLanguage: string) {
    let targetBar = window.createStatusBarItem();
    targetBar.command = 'commentTranslate.changeTargetLanguage';
    targetBar.tooltip = 'Comment translate target language. click to change';

    let setLanguageText = async () => {
        let currentLanguage = await getConfig<string>('targetLanguage') || userLanguage;
        let current = languages.get(currentLanguage);
        if (current) {
            targetBar.text = current;
        }
    }
    await setLanguageText();
    targetBar.show();
    workspace.onDidChangeConfiguration(async eventNames => {
        if (eventNames.affectsConfiguration('commentTranslate')) {
            await setLanguageText();
        };
    });

    return targetBar;
}

export async function getConfig<T>(key:string):Promise<T> {
    let configuration = workspace.getConfiguration('commentTranslate');
    return configuration.get<T>(key);
}

const Source = [
    ['Google','google'],
    ['Baidu','baidu'],
    ['Bing','bing'],
];
export async function selectTranslateSource( placeHolder: string = 'Select translate source.' ) {
    let originSource = await getConfig<string>('source');
    let items: QuickPickItem[] = Source.filter(item=>item[0] !== originSource).map(item => {
        return {
            label: item[0],
            description: item[1],
        };
    });

    let res: QuickPickItem = await window.showQuickPick(items, {placeHolder});
    if (res) {
        return res.label;
    }
    return null;
}