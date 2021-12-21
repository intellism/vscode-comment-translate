import { Position, Selection, window } from "vscode";
import { lastHover } from "../languageFeature/hover";

export async function selectLastHover() {
    let editor = window.activeTextEditor;
    if (editor) {
        // let hover = await client.sendRequest<Hover>('lastHover', { uri: editor.document.uri.toString() });
        let hover = lastHover(editor.document.uri.toString());
        if (!hover) return;
        editor.revealRange(hover.range);

        // TODO 可以取消现有选区？
        editor.selections = [new Selection(new Position(hover.range.start.line, hover.range.start.character), new Position(hover.range.end.line, hover.range.end.character))];
    }
}