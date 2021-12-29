import { commands, ExtensionContext } from "vscode";
import { changeTargetLanguage, changeTranslateSource, openOutputPannel, toggleEnableHover, toggleMultiLineMerge } from "./changeTargetLanguage";
import { replaceRange, replaceSelections } from "./replaceSelections";
import { selectLastHover } from "./select";

export function registerCommands(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerCommand('commentTranslate.select', selectLastHover),
        commands.registerCommand('commentTranslate._replaceRange', replaceRange),
        commands.registerCommand('commentTranslate.replaceSelections', replaceSelections),
        commands.registerCommand('commentTranslate._toggleMultiLineMerge', toggleMultiLineMerge),
        commands.registerCommand('commentTranslate.changeTranslateSource', changeTranslateSource),
        commands.registerCommand('commentTranslate._openOutputPannel', openOutputPannel),
        commands.registerCommand('commentTranslate.toggleEnableHover', toggleEnableHover),
        commands.registerCommand('commentTranslate.changeTargetLanguage', changeTargetLanguage)
    );
}