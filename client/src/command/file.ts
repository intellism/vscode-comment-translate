import { Selection, window } from "vscode";
import { client } from "../extension";
import { compileBlock, ICommentBlock } from "../languageFeature/compile";


export async function selectAllForType(type = 'comment') {
    let editor = window.activeTextEditor;
    if (editor) {
        let blocks = await client.sendRequest<ICommentBlock[] | null>('getAllComment',{uri: editor.document.uri.toString(),type});

        if (!blocks || blocks.length === 0) return;
        let selections = blocks.map((block => {
            const { start, end } = block.range;
            return new Selection(start.line, start.character, end.line, end.character);
        }));
        editor.selections = selections;
    }
}

export async function selectAllText() {
    return selectAllForType('text')
}

export async function selectAllComment() {
    selectAllForType('comment');
}

export async function translateAllText() {
    return translateAllForType('text')
}

export async function translateAllComment() {
    translateAllForType('comment');
}

export async function translateAllForType(type = 'comment') {
    let editor = window.activeTextEditor;
    if (editor) {
        let blocks = await client.sendRequest<ICommentBlock[] | null>('getAllComment',{uri: editor.document.uri.toString(),type});

        if (!blocks || blocks.length === 0) return;


        // const translatedBlock = await compileBlock(block,document.languageId);
        let translates = await Promise.all(blocks.map((block => {
            return compileBlock(block,  editor?.document.languageId!);
        })));
        let selections = blocks.map((block => {
            const { start, end } = block.range;
            return new Selection(start.line, start.character, end.line, end.character);
        }));
        editor.selections = selections;

        //添加装饰，提醒用户正在翻译中。 部分内容会原样返回，避免用户等待
        let decoration = window.createTextEditorDecorationType({
            color: '#FF2D00',
            backgroundColor: "transparent"
        });
        editor.setDecorations(decoration, selections);
        let beginTime = Date.now();
        try {
            let results = await Promise.all(translates);
            //最少提示1秒钟
            setTimeout(() => {
                decoration.dispose();
            }, 1000 - (Date.now() - beginTime));
            editor.edit(builder => {
                results.forEach(({translatedText},index) => {
                    let selection = selections[index];
                    translatedText && builder.replace(selection, translatedText);
                });
            });
        } catch (e:any) {
            decoration.dispose();
            client.outputChannel.append(e.toString());
        }

    }
}