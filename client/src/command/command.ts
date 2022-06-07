import { commands, ExtensionContext } from "vscode";
import { changeTargetLanguage, changeTranslateSource, openOutputPannel, toggleEnableHover, toggleMultiLineMerge } from "./changeTargetLanguage";
import { selectAllComment, selectAllText, translateAllComment, translateAllText } from "./file";
import { replaceRange, replaceSelections } from "./replaceSelections";
import { addSelection, clipboard, selectLastHover } from "./select";

export function registerCommands(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerCommand('commentTranslate.select', selectLastHover),
        commands.registerCommand('commentTranslate._addSelection', addSelection),
        commands.registerCommand('commentTranslate.selectAllText', selectAllText),
        commands.registerCommand('commentTranslate.translateAllText', translateAllText),
        commands.registerCommand('commentTranslate.selectAllComment', selectAllComment),
        commands.registerCommand('commentTranslate.translateAllComment', translateAllComment),
        commands.registerCommand('commentTranslate.clipboard', clipboard),
        commands.registerCommand('commentTranslate._replaceRange', replaceRange),
        commands.registerCommand('commentTranslate.replaceSelections', replaceSelections),
        commands.registerCommand('commentTranslate._toggleMultiLineMerge', toggleMultiLineMerge),
        commands.registerCommand('commentTranslate.changeTranslateSource', changeTranslateSource),
        commands.registerCommand('commentTranslate._openOutputPannel', openOutputPannel),
        commands.registerCommand('commentTranslate.toggleEnableHover', toggleEnableHover),
        commands.registerCommand('commentTranslate.changeTargetLanguage', changeTargetLanguage)
    );
}