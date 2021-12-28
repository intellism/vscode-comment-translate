import { Position, Selection, window } from "vscode";
import { lastHover } from "../languageFeature/hover";

export async function selectLastHover() {
    let editor = window.activeTextEditor;
    if (editor) {
        // let hover = await client.sendRequest<Hover>('lastHover', { uri: editor.document.uri.toString() });
        let hover = lastHover(editor.document.uri.toString());
        if (!hover || !hover.range) return;
        editor.revealRange(hover.range);
        const {start,end} = hover.range;

        // 会复用对象？必须重新构建
        // editor.selections = [new Selection(start,end)]; 
        editor.selections = [new Selection(start.line,start.character,end.line,end.character)];
    }
}