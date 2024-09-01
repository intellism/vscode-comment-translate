import { marked, Renderer } from "marked";
import { unescape } from "querystring";
import { detectLanguage } from "../lang";
import { Position, Range, TextDocument } from "vscode";
import { translateManager } from "../translate/manager";


const he = require("he");

marked.setOptions({
    mangle: false,
    headerIds: false
});

let renderer: Renderer = new Renderer();
renderer.heading = function (text, level) {
    return `${"#".repeat(level)} ${text}\n`;
};

renderer.code = function (code, language) {
    return `\n${"```" + language}\n${code}\n\`\`\`\n`;
};

renderer.link = function (href, title, text) {
    title = title ? ` "${title}"` : "";
    return `[${text}](${href}${title})`;
};

renderer.image = function (href, title, text) {
    return `![${text}](${href}  "${title}")`;
};

renderer.blockquote = function (quote) {
    return `> ${quote}`;
};

renderer.strong = function (text) {
    return " **" + text + "** ";
};
renderer.hr = function () {
    return "\n---\n";
};

renderer.em = function (text) {
    return "*" + text + "*";
};

renderer.html = function (html) {
    return he.decode(html);
};
renderer.codespan = function (text) {
    return "`" + he.decode(text) + "`";
};
renderer.br = function () {
    return "\n";
};

renderer.list = function (body, ordered, start) {

    if (ordered) {
        return `${start}. ${body} \n`;
    }

    return body.split("\n").filter((item) => item).map((item) => "- " + item).join("\n") + "\n\n";
};

renderer.listitem = function (text) {
    return `${text} \n`;
};
renderer.paragraph = function (text) {
    return text + "\n\n";
};

export async function getMarkdownTextValue(markStr: string) {
    let textArr: string[] = [];
    let translatedTask: Promise<string>;

    async function translate(text: string) {
        if (!translatedTask) {
            translatedTask = translateManager.translate(textArr.join("\n"));
        }
        let translated = (await translatedTask).split("\n");
        return translated[textArr.indexOf(text)];
    }

    let skipTranslate = false;

    marked.parse(markStr, {
        walkTokens: (token) => {

            // Part of the three-party plug-ins use html format to return, unable to accurately translate the content, directly skip.
            if (token.type === "html") {
                skipTranslate = true;
            }

            if (token.type === "link" && token.title) {
                let title = unescape(token.title).trim();
                if (title) {
                    textArr = textArr.concat(title.split("\n"));
                }
            }

            if (token.type === "text") {
                let text = unescape(token.text).trim();
                if (text.indexOf('$(') === 0) return;
                // if(text.indexOf(" ") < 0) return ;
                textArr = textArr.concat(text.split("\n"));
            }
        },
    });

    if (skipTranslate) {
        return { result: markStr, hasTranslated: false };
    }

    let hasTranslated = false;

    let result = await marked.parse(markStr, {
        renderer,
        walkTokens: async (token) => {

            if (token.type === "link" && token.title) {
                let title = unescape(token.title).trim();
                if (title) {
                    let arr = title.split("\n");
                    token.title = (
                        await Promise.all(
                            arr.map(async (txt) => {
                                return translate(txt);
                            })
                        )
                    ).join("\n");
                }
            }

            if (token.type === "text") {
                let text = unescape(token.text).trim();
                if (text.indexOf('$(') === 0) return;
                // if(text.indexOf(" ") < 0) return ;

                let arr = text.split("\n");
                token.text = (
                    await Promise.all(
                        arr.map(async (txt) => {

                            // If the original text is in the target language, no more translation will be performed
                            let detected = await detectLanguage(txt);
                            if (translateManager.opts.to?.indexOf(detected) === 0) {
                                return txt;
                            }

                            hasTranslated = true;
                            return translate(txt);
                        })
                    )
                ).join("\n");

                console.log(token.text);
                //   token.text = await translateManager.translate(text,{to});
            }
        },
        async: true,
    });
    result = removeTrailingNewlines(result);
    return { result, hasTranslated };
}

function removeTrailingNewlines(result: string): string {
    if (result.endsWith('\n\n')) {
        return result.slice(0, -2);
    }
    return result;
}


export async function compileMarkdown(document: TextDocument, position: Position) {

    let text = document.lineAt(position).text;

    let { hasTranslated, result: translatedText } = await getMarkdownTextValue(text);
    let range = new Range(position.line, 0, position.line, text.length);

    return { hasTranslated, translatedText, range };
}
