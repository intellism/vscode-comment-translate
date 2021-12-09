import { Selection, window } from "vscode";
import { selectTargetLanguage } from "../configuration";
import { client } from "../extension";

async function translateSelection(text: string, selection: Selection, targetLanguage:string) {
    let translation = await client.sendRequest<string>('translate', {text,targetLanguage});
    return { translation, selection };
}

//翻译选择区域并替换
export async function replaceSelections() {
    let editor = window.activeTextEditor;
    if (!(editor && editor.document &&
        editor.selections.some(selection => !selection.isEmpty))) {
        return client.outputChannel.append(`No selection！\n`);
    }
    let targetLanguage = await selectTargetLanguage();
    if(!targetLanguage) return;
    let translates = editor.selections
        .filter(selection => !selection.isEmpty)
        .map(selection => {
            let text = editor.document.getText(selection);
            return translateSelection(text, selection, targetLanguage);
        });

    //添加装饰，提醒用户正在翻译中。 部分内容会原样返回，避免用户等待
    let decoration = window.createTextEditorDecorationType({
        color: '#FF2D00',
        backgroundColor: "transparent"
    });
    editor.setDecorations(decoration, editor.selections);
    let beginTime = Date.now();
    try {
        let results = await Promise.all(translates);
        //最少提示1秒钟
        setTimeout(() => {
            decoration.dispose();
        }, 1000 - (Date.now() - beginTime));
        editor.edit(builder => {
            results.forEach(item => {
                item.translation && builder.replace(item.selection, item.translation);
            });
        });
    } catch (e) {
        decoration.dispose();
        client.outputChannel.append(e);
    }
}