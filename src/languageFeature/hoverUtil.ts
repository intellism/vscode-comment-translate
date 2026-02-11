import { MarkdownString, Range } from "vscode";
import { getConfig } from "../configuration";

export function createHoverMarkdownString(
    translatedText: string,
    humanizeText: string | undefined,
    uri: string,
    range: Range,
    document: { languageId: string },
    translateLink: string
): { md: MarkdownString, header: MarkdownString } {
    const base64TranslatedText = Buffer.from(translatedText).toString("base64");
    const space = "&nbsp;&nbsp;";
    const separator = `${space}|${space}`;
    const replace = `[$(replace)](command:commentTranslate._replaceRange?${encodeURIComponent(
        JSON.stringify({
            uri,
            range: { start: range.start, end: range.end },
            text: base64TranslatedText,
        })
    )} "Replace")`;
    const multiLine = getConfig<boolean>("multiLineMerge");
    const combine = `[$(${multiLine ? "selection" : "remove"
        })](command:commentTranslate._toggleMultiLineMerge "Toggle Combine Multi Line")`;

    // bugfix: JSON.stringify Range会变成数组。 传到下游会有问题。
    const addSelection = `[$(heart)](command:commentTranslate._addSelection?${encodeURIComponent(
        JSON.stringify({ range: { start: range.start, end: range.end } })
    )} "Add Selection")`;

    const translate = `[$(sync)](command:commentTranslate.changeTranslateSource "Change translate source")`;

    const header = new MarkdownString(
        `[Comment Translate]${space}${replace}${space}${combine}${space}${addSelection}${separator}${translate}${space}${translateLink}`,
        true
    );
    header.isTrusted = true;

    let showText = translatedText;
    if (humanizeText) {
        showText = `${humanizeText} => ${translatedText}`;
    }
    const codeDefine = "```";
    let md = new MarkdownString(
        `${codeDefine}${document.languageId}\n${showText}\n ${codeDefine}`
    );
    if (!translatedText) {
        md = new MarkdownString(
            `**Translate Error**: Check [OutputPannel](command:commentTranslate._openOutputPannel "open output pannel") for details.`
        );
        md.isTrusted = true;
    }

    return { header, md };
}
