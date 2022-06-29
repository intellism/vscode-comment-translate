
import { workspace, window, QuickPickItem, ThemeIcon, commands, MarkdownString } from 'vscode';
import { translateExtensionProvider } from './extension';
import { LANGS } from './lang';

let languages = new Map(LANGS);
let defaultLanguage: string;
export async function selectTargetLanguage(placeHolder: string = 'Select target language'):Promise<string> {
    let items: QuickPickItem[] = LANGS.map(item => {
        return {
            label: item[1],
            description: item[0],
        };
    });

    if (!defaultLanguage) {
        defaultLanguage = getConfig<string>('targetLanguage', '');
    }
    let defaultTarget = languages.get(defaultLanguage);
    defaultTarget && items.unshift({
        label: defaultTarget,
        description: defaultLanguage,
        detail: 'Default select'
    });

    let res: QuickPickItem | undefined = await new Promise<QuickPickItem | undefined>(
        async (resolve) => {
            let quickPick = window.createQuickPick();
            quickPick.items = items;
            quickPick.placeholder = placeHolder;
            let button = {
                iconPath: new ThemeIcon('settings-gear'),
                tooltip: 'Open Comment Translate setting.'
            };

            let changeTranslateSourceButton = {
                iconPath: new ThemeIcon('sync'),
                tooltip: 'Change translate source.'
            }

            quickPick.buttons = [changeTranslateSourceButton,button];
            quickPick.onDidTriggerButton(async item => {
                if (item === button) {
                    await commands.executeCommand('workbench.action.openWorkspaceSettings', {
                        query: 'commentTranslate'
                    });
                }
                if (item === changeTranslateSourceButton) {
                    await commands.executeCommand('commentTranslate.changeTranslateSource');
                }
            });
            quickPick.onDidChangeSelection((r) => {
                if (r.length > 0) {
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
        defaultLanguage = res.description || '';
        return defaultLanguage;
    }
    return '';
}


export async function showHoverStatusBar() {
    let bar = window.createStatusBarItem();
    bar.command = 'commentTranslate.toggleEnableHover';
    bar.tooltip = 'Comment translate toggle enable hover.';

    let setLanguageText = async () => {
        let enableHover = getConfig<boolean>('hover.enabled');
        bar.text = `$(${enableHover ? 'eye' : 'eye-closed'}) `;
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
    // targetBar.tooltip = 'Comment translate target language. click to change';

    const translate = `Comment translate target language. click to change. [Change translate source](command:commentTranslate.changeTranslateSource "Change translate source")`;

    let tooltip = new MarkdownString(translate);
    tooltip.isTrusted = true;
    targetBar.tooltip = tooltip;



    let setLanguageText = async () => {
        let currentLanguage = getConfig<string>('targetLanguage',userLanguage);
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
const PREFIXCONFIG = 'commentTranslate';
export function getConfiguration() {
    return workspace.getConfiguration(PREFIXCONFIG);
}


export function getConfig<T>(key: string):T | undefined;
export function getConfig<T>(key: string, defaultValue: T):T;
export function getConfig<T>(key: string, defaultValue?: T):T {
    let configuration = getConfiguration();
    let value:any = configuration.get<T>(key);
    if (typeof value === 'undefined' || value === '') {
        value = defaultValue;
    }
    return value;
}

export async function selectTranslateSource(placeHolder: string = 'Select translate source.') {
    const allTranslaton = translateExtensionProvider.getAllTransationConfig();
    let items: QuickPickItem[] = [];
    const moreItem = {
        label:'More...',
        description:'Install more translate sources from Extensions Marketplace'
    };
    for (let [id, conf] of allTranslaton) {
        let {category='',title} = conf;
        if (category) {
            category = category + ':';
        }

        items.push({
            label: category + title,
            description: id
        });
    }
    items.push(moreItem);
    let res: QuickPickItem | undefined = await window.showQuickPick(items, { placeHolder });
    if (res) {
        if(res.description === moreItem.description) {
            commands.executeCommand('workbench.extensions.search','@tag:translateSource');
            return null;
        }
        return res.description;
    }
    return null;
}