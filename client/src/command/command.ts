import { commands, ExtensionContext } from "vscode";
import { changeTargetLanguage } from "./changeTargetLanguage";
import { replaceRange, replaceSelections } from "./replaceSelections";
import { selectLastHover } from "./select";

export function registerCommands(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerCommand('commentTranslate.select', selectLastHover),
        commands.registerCommand('commentTranslate.replaceRange', replaceRange),
        commands.registerCommand('commentTranslate.replaceSelections', replaceSelections),
        commands.registerCommand('commentTranslate.changeTargetLanguage', changeTargetLanguage)
    );
}