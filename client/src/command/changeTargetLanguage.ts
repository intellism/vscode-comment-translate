import { workspace } from "vscode";
import { selectTargetLanguage } from "../configuration";

// 更改目标语言命令
export async function changeTargetLanguage () {
    let configuration = workspace.getConfiguration('commentTranslate');
    let target = await selectTargetLanguage();
    if (target) {
        await configuration.update('targetLanguage', target);
    }
}

export async function changeTranslateSource() {
    
}