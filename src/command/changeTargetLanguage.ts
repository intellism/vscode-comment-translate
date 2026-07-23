import { window } from "vscode";
import { getConfig, selectTargetLanguage, selectTranslateSource, updateConfig } from "../configuration";
import { outputChannel } from "../extension";
import { commentDecorationManager } from "../languageFeature/decoration";
import { translateExtensionProvider } from "../translate/manager";

// 更改目标语言命令
export async function changeTargetLanguage() {
    let target = await selectTargetLanguage();
    if (target) {
        await updateConfig('targetLanguage', target);
    }
}

export async function changeTranslateSource() {
    let targetSource = await selectTranslateSource();
    if (targetSource) {
        let success = await translateExtensionProvider.switchTranslate(targetSource);
        if (success) {
            await updateConfig('source', targetSource);
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
    let origin = getConfig<boolean>('multiLineMerge');
    await updateConfig('multiLineMerge', !origin);
}

export async function toggleEnableHover() {
    let origin = getConfig<boolean>('hover.enabled');
    await updateConfig('hover.enabled', !origin);
}

export async function openOutputPannel() {
    outputChannel.show(true);
}

export async function toggleBrowseMode() {
    let origin = getConfig<string>('browse.mode');
    let targetMode = origin === 'contrast' ? 'inplace' : 'contrast';
    await updateConfig('browse.mode', targetMode);
}

export async function toggleTempBrowseMode() {
    commentDecorationManager.toggleBrowseCommentTranslate();
}
