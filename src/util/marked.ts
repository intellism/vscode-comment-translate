import { marked, Renderer } from "marked";
import { translateManager } from "../extension";
import { unescape } from "querystring";
const he = require("he");

marked.setOptions({
  mangle: false,
  headerIds: false
});

let renderer: Renderer = new Renderer();
renderer.heading = function (text, level) {
  return `${"#".repeat(level)} ${text}`;
};
renderer.code = function (code, language) {
  return `\n${"```" + language}\n${code}\n\`\`\`\n`;
};

renderer.link = function (href, title, text) {
  return `[${text}](${href} "${title}")`;
};

renderer.image = function (href, title, text) {
  return `![${text}](${href}  "${title})`;
};

renderer.blockquote = function (quote) {
  return `\n> ${quote}`;
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

renderer.list = function (body) {
  return "\n\n\n" + body + "\n\n\n";
};

renderer.listitem = function (text) {
  return `* ${text}\n`;
};
renderer.paragraph = function (text) {
  return text + "\n\n";
};

export async function getMarkdownTextValue(markStr: string, to: string) {
  const asyncText: string[] = [];
  let textArr: string[] = [];
  let translatedTask: Promise<string>;

  async function translate(text: string) {
    if (!translatedTask) {
      translatedTask = translateManager.translate(textArr.join("\n"), { to });
    }
    let translated = (await translatedTask).split("\n");
    return translated[textArr.indexOf(text)];
  }

  marked.parse(markStr, {
    walkTokens: (token) => {
      if (token.type === "text") {
        let text = unescape(token.text).trim();
        if (text && text.indexOf(" ") >= 0) {
          textArr = textArr.concat(text.split("\n"));
        }
      }
    },
  });

  let result = await marked.parse(markStr, {
    renderer,
    walkTokens: async (token) => {
      if (token.type === "text") {
        let text = unescape(token.text).trim();
        if (text && text.indexOf(" ") >= 0) {
          asyncText.push(text);
          let arr = text.split("\n");

          token.text = (
            await Promise.all(
              arr.map(async (txt) => {
                return translate(txt);
              })
            )
          ).join("\n");
          //   token.text = await translateManager.translate(text,{to});
        }
      }
    },
    async: true,
  });

  return result;
}
