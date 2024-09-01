import { env, commands, ExtensionContext, Selection, TextEditorSelectionChangeKind, window, Range } from "vscode";
import { outputChannel } from "../extension";
import { lastHover } from "../languageFeature/hover";
import { isCode } from "../util/string";
import { translateManager } from "../translate/manager";


export async function clipboard() {
    let text = await env.clipboard.readText();
    if (!text) {
        outputChannel.appendLine('clipboard:The clipboard is empty');
        return;
    }
    let translatedText = await translateManager.translate(text);
    outputChannel.appendLine('clipboard:' + translatedText);
    await window.showInformationMessage(translatedText, { detail: text, modal: false });
}

export async function selectLastHover() {
    let editor = window.activeTextEditor;
    if (editor) {
        let range = lastHover(editor.document.uri.toString());
        if (!range) return;
        editor.revealRange(range);
        const { start, end } = range;
        editor.selections = [new Selection(start.line, start.character, end.line, end.character)];
    }
}

export async function addSelection({ range }: { range: Range }) {
    let editor = window.activeTextEditor;
    if (editor) {
        const { start, end } = range;
        editor.selections = [new Selection(start.line, start.character, end.line, end.character), ...editor.selections];
        window.showTextDocument(editor.document); // 文档获取焦点
    }
}

export function mouseToSelect(context: ExtensionContext) {
    let lastShowHover: number;
    let showHoverTimer: NodeJS.Timeout;
    // During normal coding, it will also be triggered when a large section of code is selected. The isCode() judgment can be added to reduce unnecessary reminders.
    context.subscriptions.push(window.onDidChangeTextEditorSelection((e) => {
        // 只支持划词翻译
        if (e.kind !== TextEditorSelectionChangeKind.Mouse) return;
        let selections = e.selections.filter(selection => !selection.isEmpty);
        if (selections.length === 0 || selections.length > 1) return;


        let laterTime = 300;
        if (lastShowHover) {
            let gap = (new Date()).getTime() - lastShowHover;
            laterTime = Math.max(600 - gap, 300);
        }
        clearTimeout(showHoverTimer);
        showHoverTimer = setTimeout(() => {
            let selectionText = e.textEditor.document.getText(selections[0]);
            if (selectionText.length > 1000) return;
            if (isCode(selectionText)) return;
            commands.executeCommand('editor.action.showHover', { focus: "noAutoFocus" });
            lastShowHover = (new Date()).getTime();
        }, laterTime);
    }));
}


