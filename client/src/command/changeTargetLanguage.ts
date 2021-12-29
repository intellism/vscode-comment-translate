import { window, workspace } from "vscode";
import { selectTargetLanguage, selectTranslateSource } from "../configuration";
import { outputChannel, translateExtensionProvider } from "../extension";

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
        let success = await translateExtensionProvider.switchTranslate(targetSource);
        if(success) {
            const configuration = workspace.getConfiguration('commentTranslate');
            await configuration.update('source', targetSource);
            const msg = `Switch translate source to '${targetSource}'.`;
            outputChannel.appendLine(msg);
        } else {
            const errorMsg = `Can not switch translate source to '${targetSource}'.`;
            outputChannel.appendLine(errorMsg);
            window.showErrorMessage(errorMsg)
        }
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

export async function openOutputPannel() {
    outputChannel.show(true);
}