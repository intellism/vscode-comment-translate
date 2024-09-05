import { window } from "vscode";
import { getConfiguration, selectTargetLanguage, selectTranslateSource } from "../configuration";
import { outputChannel } from "../extension";
import { commentDecorationManager } from "../languageFeature/decoration";
import { translateExtensionProvider } from "../translate/manager";

// 更改目标语言命令
export async function changeTargetLanguage() {
    let target = await selectTargetLanguage();
    if (target) {
        const configuration = getConfiguration();
        await configuration.update('targetLanguage', target);
    }
}

export async function changeTranslateSource() {
    let targetSource = await selectTranslateSource();
    if (targetSource) {
        let success = await translateExtensionProvider.switchTranslate(targetSource);
        if (success) {
            const configuration = getConfiguration();
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
    let configuration = getConfiguration();
    let origin = await configuration.get<boolean>('multiLineMerge');
    await configuration.update('multiLineMerge', !origin);
}

export async function toggleEnableHover() {
    let configuration = getConfiguration();
    let origin = await configuration.get<boolean>('hover.enabled');
    await configuration.update('hover.enabled', !origin);
}

export async function openOutputPannel() {
    outputChannel.show(true);
}

export async function toggleBrowseMode() {
    let configuration = getConfiguration();
    let origin = await configuration.get<string>('browse.mode');
    let targetMode = origin === 'contrast' ? 'inplace' : 'contrast';

    await configuration.update('browse.mode', targetMode);
}

export async function toggleTempBrowseMode() {
    commentDecorationManager.toggleBrowseCommentTranslate();
}
