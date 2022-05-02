import { Selection, window, Range, Position, TextEditor } from "vscode";
import { selectTargetLanguage } from "../configuration";
import { client, translateManager } from "../extension";
import { Configuration } from "../comments/configuration";
import { Parser } from "../comments/parser";
async function translateSelection(text: string, selection: Range, targetLanguage: string) {
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
            text && builder.replace(new Range(new Position(range.start.line, range.start.character), new Position(range.end.line, range.end.character)), text);
        });
    } catch (e:any) {
        decoration.dispose();
        client.outputChannel.append(e.toString());
    }

}

export async function replaceAllCommentsInFile() {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor || !activeEditor.document) {
        return client.outputChannel.append(`No one file opened\n`);
    }

    let configuration: Configuration = new Configuration();
    let parser: Parser = new Parser(configuration);

    // Set the regex patterns for the specified language's comments
    parser.SetRegex(activeEditor.document.languageId);

    // if lanugage isn't supported, return
    if (!parser.supportedLanguage) return;

    // Finds the single line comments using the language comment delimiter
    parser.FindSingleLineComments(activeEditor);

    // Finds the multi line comments using the language comment delimiter
    parser.FindBlockComments(activeEditor);

    // Finds the jsdoc comments
    parser.FindJSDocComments(activeEditor);

    await replaceRanges(activeEditor, parser.getRangesWithoutDuplicates())
}

//翻译选择区域并替换
export async function replaceSelections() {
    let editor = window.activeTextEditor;


    if (!editor || !editor.document || !editor.selections || editor.selections.length === 0) {
        return client.outputChannel.append(`No selection！\n`);
    }

    const validSelections = editor.selections
    .filter(selection => !selection.isEmpty);
        .filter(selection => !selection.isEmpty);

    await replaceRanges(editor, validSelections);
}

async function replaceRanges(editor: TextEditor, validSelections: Range[]) {
    if(validSelections.length === 0) {
        return client.outputChannel.append(`No selection！\n`);
    }

    let targetLanguage = await selectTargetLanguage();
    if (!targetLanguage) return;
    let translates = validSelections.map(selection => {
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