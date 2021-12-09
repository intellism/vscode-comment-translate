import { Hover, Position, Selection, window } from "vscode";
import { client } from "../extension";

export async function selectLastHover() {
    let editor = window.activeTextEditor;
    if (editor) {
        let hover = await client.sendRequest<Hover>('lastHover', { uri: editor.document.uri.toString() });
        if (!hover) return;
        editor.revealRange(hover.range);
        editor.selections = [new Selection(new Position(hover.range.start.line, hover.range.start.character), new Position(hover.range.end.line, hover.range.end.character)), ...editor.selections];
    }
}