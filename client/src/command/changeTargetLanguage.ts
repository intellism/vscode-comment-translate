import { workspace } from "vscode";
import { selectTargetLanguage, selectTranslateSource } from "../configuration";
import { translationProvider } from "../extension";

// 更改目标语言命令
export async function changeTargetLanguage () {
    let target = await selectTargetLanguage();
    if (target) {
        const configuration = workspace.getConfiguration('commentTranslate');
        await configuration.update('targetLanguage', target);
    }
}

export async function changeTranslateSource() {
    let targetSource = await selectTranslateSource();
    if(targetSource) {
        await translationProvider.selectTranslation(targetSource);
        const configuration = workspace.getConfiguration('commentTranslate');
        await configuration.update('source', targetSource);
    }
}

export async function toggleMultiLineMerge() {
    let configuration = workspace.getConfiguration('commentTranslate');
    let origin = await configuration.get<boolean>('multiLineMerge');
    await configuration.update('multiLineMerge', !origin);
}

export async function toggleEnableHover() {
    let configuration = workspace.getConfiguration('commentTranslate');
    let origin = await configuration.get<boolean>('hover.open');
    await configuration.update('hover.open', !origin);
}