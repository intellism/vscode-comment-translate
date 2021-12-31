import { Selection, window, Range, Position } from "vscode";
import { selectTargetLanguage } from "../configuration";
import { client, translateManager } from "../extension";
async function translateSelection(text: string, selection: Selection, targetLanguage: string) {
    // let translation = await client.sendRequest<string>('translate', { text, targetLanguage });
    let translatedText = await translateManager.translate(text, {to:targetLanguage});
    return { translatedText, selection };
}

export async function replaceRange({ uri, text, range }: { uri: string, text: string, range: Range }) {
    let editor = window.activeTextEditor;
    // 传入uri已经被decode了,所以都decode一下
    if (!(editor && editor.document && decodeURIComponent(editor.document.uri.toString()) === decodeURIComponent(uri))) {
        return client.outputChannel.append(`Not active editor`);
    }

    text = Buffer.from(text , 'base64').toString();
    let decoration = window.createTextEditorDecorationType({
        color: '#FF2D00',
        backgroundColor: "transparent"
    });
    editor.setDecorations(decoration, [range]);
    setTimeout(() => {
        decoration.dispose();
    }, 500);
    try {
        editor.revealRange(range);
        editor.edit(builder => {
            text && builder.replace(new Selection(new Position(range.start.line, range.start.character), new Position(range.end.line, range.end.character)), text);
        });
    } catch (e:any) {
        decoration.dispose();
        client.outputChannel.append(e.toString());
    }

}

//翻译选择区域并替换
export async function replaceSelections() {
    let editor = window.activeTextEditor;
    if (!editor || editor.document ||
        editor.selections.some(selection => !selection.isEmpty)) {
        return client.outputChannel.append(`No selection！\n`);
    }
    let targetLanguage = await selectTargetLanguage();
    if (!targetLanguage) return;
    let translates = editor.selections
        .filter(selection => !selection.isEmpty)
        .map(selection => {
            // @ts-ignore
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
            results.forEach(({translatedText, selection}) => {
                translatedText && builder.replace(selection, translatedText);
            });
        });
    } catch (e:any) {
        decoration.dispose();
        client.outputChannel.append(e.toString());
    }
}