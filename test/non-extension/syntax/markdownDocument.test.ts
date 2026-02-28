import {
    parseMarkdownLines,
    extractTranslatableTexts,
    reconstructDocument,
    translateMarkdownDocument,
    stripBoldInitial,
    restoreBoldInitial,
    replaceInlinePlaceholders,
    restoreInlinePlaceholders,
} from "../../../src/syntax/markdownDocument";
import { getFixtureFile } from "../mocks";

jest.mock("../../../src/translate/manager", () => {
    return {
        translateManager: {
            translate: jest.fn(),
            link: jest.fn(),
            opts: {
                to: "zh-CN",
            },
        },
    };
});

// ── Bold initial letter handling ─────────────────────────────────────────

describe("stripBoldInitial", () => {
    it("should strip bold initial letter when followed by rest of word without space", () => {
        const result = stripBoldInitial("**T**his is a test");
        expect(result.stripped).toBe("This is a test");
        expect(result.letter).toBe("T");
    });

    it("should not strip when bold wraps a full word with space after", () => {
        const result = stripBoldInitial("**Multiple** words in bold");
        expect(result.stripped).toBe("**Multiple** words in bold");
        expect(result.letter).toBeNull();
    });

    it("should handle lowercase bold initial", () => {
        const result = stripBoldInitial("**a**nother test");
        expect(result.stripped).toBe("another test");
        expect(result.letter).toBe("a");
    });

    it("should return original text when no bold initial pattern", () => {
        const result = stripBoldInitial("Normal text without bold");
        expect(result.stripped).toBe("Normal text without bold");
        expect(result.letter).toBeNull();
    });
});

describe("restoreBoldInitial", () => {
    it("should restore bold initial on translated text", () => {
        const result = restoreBoldInitial("这是一个测试", "T");
        expect(result).toBe("**这**是一个测试");
    });

    it("should restore bold initial for English text", () => {
        const result = restoreBoldInitial("Another test", "A");
        expect(result).toBe("**A**nother test");
    });

    it("should not modify when letter is null", () => {
        const result = restoreBoldInitial("Normal text", null);
        expect(result).toBe("Normal text");
    });

    it("should handle empty translated text", () => {
        const result = restoreBoldInitial("", "T");
        expect(result).toBe("");
    });
});

// ── Inline placeholder handling ──────────────────────────────────────────

describe("replaceInlinePlaceholders", () => {
    it("should replace inline code with placeholders", () => {
        const { cleaned, entries } = replaceInlinePlaceholders("Use `console.log` to debug");
        expect(cleaned).not.toContain("`console.log`");
        expect(entries.length).toBe(1);
        expect(entries[0].original).toBe("`console.log`");
    });

    it("should replace inline math with placeholders", () => {
        const { cleaned, entries } = replaceInlinePlaceholders("The formula $x^2 + y^2 = z^2$ is well known");
        expect(cleaned).not.toContain("$x^2 + y^2 = z^2$");
        expect(entries.length).toBe(1);
        expect(entries[0].original).toBe("$x^2 + y^2 = z^2$");
    });

    it("should replace images with placeholders", () => {
        const { cleaned, entries } = replaceInlinePlaceholders("See ![alt text](image.png) for details");
        expect(cleaned).not.toContain("![alt text](image.png)");
        expect(entries.some(entry => entry.original === "![alt text](image.png)")).toBe(true);
    });

    it("should handle links by keeping text translatable", () => {
        const { cleaned, entries } = replaceInlinePlaceholders("Visit [our website](https://example.com) today");
        // The link text "our website" should remain in the cleaned text
        expect(cleaned).toContain("our website");
        // The URL part should be in a placeholder
        expect(entries.some(entry => entry.original.includes("https://example.com"))).toBe(true);
    });

    it("should handle multiple inline elements", () => {
        const result = replaceInlinePlaceholders("Use `code` and $math$ together");
        expect(result.entries.length).toBe(2);
    });
});

describe("restoreInlinePlaceholders", () => {
    it("should restore all placeholders back to original", () => {
        const original = "Use `console.log` and $x^2$ together";
        const { cleaned, entries } = replaceInlinePlaceholders(original);
        const restored = restoreInlinePlaceholders(cleaned, entries);
        expect(restored).toBe(original);
    });
});

// ── Line parsing ─────────────────────────────────────────────────────────

describe("parseMarkdownLines", () => {
    it("should mark YAML front matter as non-translatable", () => {
        const source = `---
title: Hello
date: 2024-01-01
---

# Hello`;
        const metas = parseMarkdownLines(source);
        // Lines 0-3 are YAML front matter (---, title, date, ---)
        expect(metas[0].translatable).toBe(false);
        expect(metas[1].translatable).toBe(false);
        expect(metas[2].translatable).toBe(false);
        expect(metas[3].translatable).toBe(false);
        // Line 4 is empty
        expect(metas[4].translatable).toBe(false);
        // Line 5 is heading
        expect(metas[5].translatable).toBe(true);
        expect(metas[5].textToTranslate).toBe("Hello");
    });

    it("should mark fenced code blocks as non-translatable", () => {
        const source = `Some text

\`\`\`javascript
const x = 1;
console.log(x);
\`\`\`

More text`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true); // "Some text"
        expect(metas[2].translatable).toBe(false); // ```javascript
        expect(metas[3].translatable).toBe(false); // const x = 1;
        expect(metas[4].translatable).toBe(false); // console.log(x);
        expect(metas[5].translatable).toBe(false); // ```
        expect(metas[7].translatable).toBe(true); // "More text"
    });

    it("should mark math blocks as non-translatable", () => {
        const source = `Text before

$$
E = mc^2
$$

Text after`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true);
        expect(metas[2].translatable).toBe(false); // $$
        expect(metas[3].translatable).toBe(false); // E = mc^2
        expect(metas[4].translatable).toBe(false); // $$
        expect(metas[6].translatable).toBe(true);
    });

    it("should parse headings with correct prefix", () => {
        const source = `# Title
## Subtitle
### Section`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true);
        expect(metas[0].prefix).toBe("# ");
        expect(metas[0].textToTranslate).toBe("Title");
        expect(metas[1].prefix).toBe("## ");
        expect(metas[1].textToTranslate).toBe("Subtitle");
        expect(metas[2].prefix).toBe("### ");
        expect(metas[2].textToTranslate).toBe("Section");
    });

    it("should parse blockquotes with correct prefix", () => {
        const source = `> This is a quote
> with multiple lines`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true);
        expect(metas[0].prefix).toBe("> ");
        expect(metas[0].textToTranslate).toBe("This is a quote");
        expect(metas[1].prefix).toBe("> ");
        expect(metas[1].textToTranslate).toBe("with multiple lines");
    });

    it("should parse unordered list items", () => {
        const source = `- First item
- Second item
* Third item`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true);
        expect(metas[0].prefix).toBe("- ");
        expect(metas[0].textToTranslate).toBe("First item");
        expect(metas[2].prefix).toBe("* ");
        expect(metas[2].textToTranslate).toBe("Third item");
    });

    it("should parse ordered list items", () => {
        const source = `1. First item
2. Second item`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true);
        expect(metas[0].prefix).toBe("1. ");
        expect(metas[0].textToTranslate).toBe("First item");
        expect(metas[1].prefix).toBe("2. ");
        expect(metas[1].textToTranslate).toBe("Second item");
    });

    it("should mark empty lines as non-translatable", () => {
        const source = `Text

More text`;
        const metas = parseMarkdownLines(source);
        expect(metas[1].translatable).toBe(false);
    });

    it("should mark table separator lines as non-translatable", () => {
        const source = `| Col1 | Col2 |
|------|------|
| A    | B    |`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true); // header row
        expect(metas[1].translatable).toBe(false); // separator
        expect(metas[2].translatable).toBe(true); // data row
    });

    it("should handle bold initial letter pattern", () => {
        const source = `**T**his is a paragraph`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true);
        expect(metas[0].textToTranslate).toBe("This is a paragraph");
        expect(metas[0].prefix).toContain("\x00BOLD_INITIAL\x00");
    });

    it("should NOT treat **Multiple** as bold initial", () => {
        const source = `**Multiple** words in bold`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(true);
        expect(metas[0].textToTranslate).toBe("**Multiple** words in bold");
        expect(metas[0].prefix).not.toContain("BOLD_INITIAL");
    });

    it("should mark HTML block tags as non-translatable", () => {
        const source = `<p align="center">
  <img alt="logo" src="logo.png" />
</p>

Normal text`;
        const metas = parseMarkdownLines(source);
        expect(metas[0].translatable).toBe(false);
        expect(metas[1].translatable).toBe(false);
        expect(metas[2].translatable).toBe(false);
        expect(metas[4].translatable).toBe(true);
    });

    it("should preserve line count", () => {
        const source = `# Title

Paragraph one.

\`\`\`js
code();
\`\`\`

Paragraph two.`;
        const metas = parseMarkdownLines(source);
        expect(metas.length).toBe(source.split("\n").length);
    });
});

// ── Extract translatable texts ───────────────────────────────────────────

describe("extractTranslatableTexts", () => {
    it("should extract only translatable lines", () => {
        const source = `---
title: Test
---

# Hello

\`\`\`js
code();
\`\`\`

World`;
        const metas = parseMarkdownLines(source);
        const texts = extractTranslatableTexts(metas);
        expect(texts).toEqual(["Hello", "World"]);
    });
});

// ── Document reconstruction ──────────────────────────────────────────────

describe("reconstructDocument", () => {
    it("should reconstruct document with translated texts preserving format", () => {
        const source = `# Hello

This is a test.

\`\`\`js
code();
\`\`\`

Goodbye.`;
        const metas = parseMarkdownLines(source);
        const translatedTexts = ["你好", "这是一个测试。", "再见。"];
        const result = reconstructDocument(metas, translatedTexts);
        const resultLines = result.split("\n");
        const sourceLines = source.split("\n");

        expect(resultLines.length).toBe(sourceLines.length);
        expect(resultLines[0]).toBe("# 你好");
        expect(resultLines[2]).toBe("这是一个测试。");
        expect(resultLines[4]).toBe("```js");
        expect(resultLines[5]).toBe("code();");
        expect(resultLines[6]).toBe("```");
        expect(resultLines[8]).toBe("再见。");
    });

    it("should reconstruct bold initial letter", () => {
        const source = `**T**his is bold initial`;
        const metas = parseMarkdownLines(source);
        const translatedTexts = ["这是粗体首字母"];
        const result = reconstructDocument(metas, translatedTexts);
        expect(result).toBe("**这**是粗体首字母");
    });

    it("should reconstruct table rows", () => {
        const source = `| Column 1 | Column 2 |
|----------|----------|
| Cell A   | Cell B   |`;
        const metas = parseMarkdownLines(source);
        const translatedTexts = ["列 1\n列 2", "单元格 A\n单元格 B"];
        const result = reconstructDocument(metas, translatedTexts);
        const lines = result.split("\n");
        expect(lines.length).toBe(3);
        expect(lines[1]).toBe("|----------|----------|");
    });
});

// ── Full translation pipeline ────────────────────────────────────────────

describe("translateMarkdownDocument", () => {
    it("should translate a simple document preserving structure", async () => {
        const source = `# Hello World

This is a paragraph.

- Item one
- Item two`;

        // Mock translate function that prefixes each line with [ZH]
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text
                .split("\n")
                .map((line) => `[ZH]${line}`)
                .join("\n");
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        const lines = result.split("\n");

        expect(lines.length).toBe(source.split("\n").length);
        expect(lines[0]).toBe("# [ZH]Hello World");
        expect(lines[1]).toBe("");
        expect(lines[2]).toBe("[ZH]This is a paragraph.");
        expect(lines[3]).toBe("");
        expect(lines[4]).toBe("- [ZH]Item one");
        expect(lines[5]).toBe("- [ZH]Item two");
    });

    it("should not translate code blocks", async () => {
        const source = `Text before

\`\`\`python
def hello():
    pass
\`\`\`

Text after`;

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text
                .split("\n")
                .map((line) => `[ZH]${line}`)
                .join("\n");
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        const lines = result.split("\n");

        expect(lines[0]).toBe("[ZH]Text before");
        expect(lines[2]).toBe("```python");
        expect(lines[3]).toBe("def hello():");
        expect(lines[4]).toBe("    pass");
        expect(lines[5]).toBe("```");
        expect(lines[7]).toBe("[ZH]Text after");
    });

    it("should not translate YAML front matter", async () => {
        const source = `---
title: Hello
---

# Greeting`;

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text
                .split("\n")
                .map((line) => `[ZH]${line}`)
                .join("\n");
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        const lines = result.split("\n");

        expect(lines[0]).toBe("---");
        expect(lines[1]).toBe("title: Hello");
        expect(lines[2]).toBe("---");
        expect(lines[4]).toBe("# [ZH]Greeting");
    });

    it("should not translate math blocks", async () => {
        const source = `Text before

$$
E = mc^2
$$

Text after`;

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text
                .split("\n")
                .map((line) => `[ZH]${line}`)
                .join("\n");
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        const lines = result.split("\n");

        expect(lines[0]).toBe("[ZH]Text before");
        expect(lines[2]).toBe("$$");
        expect(lines[3]).toBe("E = mc^2");
        expect(lines[4]).toBe("$$");
        expect(lines[6]).toBe("[ZH]Text after");
    });

    it("should preserve inline code in translated text", async () => {
        const source = "Use `console.log` to debug your code";

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            // Simulate translator that just passes through (with placeholders)
            return text;
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        expect(result).toContain("`console.log`");
    });

    it("should preserve inline math in translated text", async () => {
        const source = "The formula $x^2 + y^2 = z^2$ is Pythagorean";

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text;
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        expect(result).toContain("$x^2 + y^2 = z^2$");
    });

    it("should handle bold initial letter correctly", async () => {
        const source = `**T**his is a paragraph with bold initial letter.`;

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            // Translator receives "This is a paragraph with bold initial letter."
            expect(text).toContain("This is a paragraph");
            return "这是一个带有粗体首字母的段落。";
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        // Should restore bold initial on the first character of translated text
        expect(result).toBe("**这**是一个带有粗体首字母的段落。");
    });

    it("should return source unchanged when nothing is translatable", async () => {
        const source = `\`\`\`js
code();
\`\`\``;

        const mockTranslate = jest.fn();
        const result = await translateMarkdownDocument(source, mockTranslate);
        expect(result).toBe(source);
        expect(mockTranslate).not.toHaveBeenCalled();
    });

    it("should handle document with all features combined", async () => {
        const source = `---
title: Test
---

# Introduction

**T**his is a document with many features.

## Code

\`\`\`python
def hello():
    return 42
\`\`\`

## Math

$$
\\int_0^1 x^2 dx
$$

Inline math $\\alpha$ is preserved.

> A blockquote here

- List item one
- List item two

| Col1 | Col2 |
|------|------|
| A    | B    |

The end.`;

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text
                .split("\n")
                .map((line) => `[ZH]${line}`)
                .join("\n");
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        const sourceLines = source.split("\n");
        const resultLines = result.split("\n");

        // Line count must match
        expect(resultLines.length).toBe(sourceLines.length);

        // YAML front matter preserved
        expect(resultLines[0]).toBe("---");
        expect(resultLines[1]).toBe("title: Test");
        expect(resultLines[2]).toBe("---");

        // Heading translated
        expect(resultLines[4]).toBe("# [ZH]Introduction");

        // Code block preserved (line 10-13)
        expect(resultLines[10]).toBe("```python");
        expect(resultLines[11]).toBe("def hello():");
        expect(resultLines[12]).toBe("    return 42");
        expect(resultLines[13]).toBe("```");

        // Math block preserved (line 17-19)
        expect(resultLines[17]).toBe("$$");
        expect(resultLines[18]).toBe("\\int_0^1 x^2 dx");
        expect(resultLines[19]).toBe("$$");

        // Blockquote translated (line 23)
        expect(resultLines[23]).toMatch(/^> /);

        // List items translated (line 25-26)
        expect(resultLines[25]).toMatch(/^- /);
        expect(resultLines[26]).toMatch(/^- /);

        // Table separator preserved (line 29)
        expect(resultLines[29]).toBe("|------|------|");
    });
});

// ── Fixture file tests ───────────────────────────────────────────────────

describe("parseMarkdownLines with fixture files", () => {
    it("should parse markdown-with-frontmatter.md preserving line count", async () => {
        const source = await getFixtureFile("markdown-with-frontmatter.md");
        const metas = parseMarkdownLines(source);
        expect(metas.length).toBe(source.split("\n").length);

        // YAML front matter (lines 0-6) should be non-translatable
        for (let i = 0; i <= 6; i++) {
            expect(metas[i].translatable).toBe(false);
        }
    });

    it("should parse markdown-with-math.md preserving math blocks", async () => {
        const source = await getFixtureFile("markdown-with-math.md");
        const metas = parseMarkdownLines(source);
        expect(metas.length).toBe(source.split("\n").length);

        // Find math block lines and verify they are non-translatable
        const mathBlockLines = metas.filter(
            (meta) => meta.raw.trim() === "$$" || meta.raw.includes("\\int") || meta.raw.includes("\\sum") || meta.raw.includes("\\frac")
        );
        mathBlockLines.forEach((meta) => {
            expect(meta.translatable).toBe(false);
        });
    });

    it("should parse markdown-bold-initial.md handling bold initials", async () => {
        const source = await getFixtureFile("markdown-bold-initial.md");
        const metas = parseMarkdownLines(source);

        // Find lines with bold initial pattern
        const boldInitialLines = metas.filter((meta) => meta.prefix.includes("\x00BOLD_INITIAL\x00"));
        expect(boldInitialLines.length).toBeGreaterThan(0);

        // Verify the text sent to translation has the initial merged
        boldInitialLines.forEach((meta) => {
            expect(meta.textToTranslate).not.toMatch(/^\*\*/);
        });
    });

    it("should translate live-share-public-preview.md preserving line count", async () => {
        const source = await getFixtureFile("live-share-public-preview.md");

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text
                .split("\n")
                .map((line) => `[ZH]${line}`)
                .join("\n");
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        expect(result.split("\n").length).toBe(source.split("\n").length);
    });
});

// ── Inline code preservation in lists and tables ─────────────────────────

describe("translateMarkdownDocument with inline code in lists and tables", () => {
    const STREAMING_MODES_SOURCE = `## Preview streaming modes

Canonical key: \`channels.<channel>.streaming\`

Modes:

- \`off\`: disable preview streaming.
- \`partial\`: single preview that is replaced with latest text.
- \`block\`: preview updates in chunked/appended steps.
- \`progress\`: progress/status preview during generation, final answer at completion.

### Channel mapping

| Channel  | \`off\` | \`partial\` | \`block\` | \`progress\`        |
| -------- | ----- | --------- | ------- | ----------------- |
| Telegram | ✅    | ✅        | ✅      | maps to \`partial\` |
| Discord  | ✅    | ✅        | ✅      | maps to \`partial\` |
| Slack    | ✅    | ✅        | ✅      | ✅                |

Slack-only:

- \`channels.slack.nativeStreaming\` toggles Slack native streaming API calls when \`streaming=partial\` (default: \`true\`).

Legacy key migration:

- Telegram: \`streamMode\` + boolean \`streaming\` auto-migrate to \`streaming\` enum.
- Discord: \`streamMode\` + boolean \`streaming\` auto-migrate to \`streaming\` enum.
- Slack: \`streamMode\` auto-migrates to \`streaming\` enum; boolean \`streaming\` auto-migrates to \`nativeStreaming\`.

### Runtime behavior

Telegram:

- Uses Bot API \`sendMessage\` + \`editMessageText\`.
- Preview streaming is skipped when Telegram block streaming is explicitly enabled (to avoid double-streaming).
- \`/reasoning stream\` can write reasoning to preview.

Discord:

- Uses send + edit preview messages.
- \`block\` mode uses draft chunking (\`draftChunk\`).
- Preview streaming is skipped when Discord block streaming is explicitly enabled.

Slack:

- \`partial\` can use Slack native streaming (\`chat.startStream\`/\`append\`/\`stop\`) when available.
- \`block\` uses append-style draft previews.
- \`progress\` uses status preview text, then final answer.`;

    it("should preserve line count", async () => {
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => `[ZH]${line}`).join("\n");
        });

        const result = await translateMarkdownDocument(STREAMING_MODES_SOURCE, mockTranslate);
        expect(result.split("\n").length).toBe(STREAMING_MODES_SOURCE.split("\n").length);
    });

    it("should preserve inline code in list items", async () => {
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => `[ZH]${line}`).join("\n");
        });

        const result = await translateMarkdownDocument(STREAMING_MODES_SOURCE, mockTranslate);
        const lines = result.split("\n");

        // "- `off`: disable preview streaming." should keep `off` intact
        const offLine = lines.find((line) => line.includes("`off`"));
        expect(offLine).toBeDefined();
        expect(offLine).toContain("`off`");
        expect(offLine).toMatch(/^- /);

        // "- `partial`: ..." should keep `partial` intact
        const partialLine = lines.find((line) => line.startsWith("- ") && line.includes("`partial`"));
        expect(partialLine).toBeDefined();
        expect(partialLine).toContain("`partial`");

        // "- `block`: ..." should keep `block` intact
        const blockLine = lines.find((line) => line.startsWith("- ") && line.includes("`block`"));
        expect(blockLine).toBeDefined();
        expect(blockLine).toContain("`block`");

        // "- `progress`: ..." should keep `progress` intact
        const progressLine = lines.find((line) => line.startsWith("- ") && line.includes("`progress`"));
        expect(progressLine).toBeDefined();
        expect(progressLine).toContain("`progress`");
    });

    it("should preserve table structure and inline code in table cells", async () => {
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => `[ZH]${line}`).join("\n");
        });

        const result = await translateMarkdownDocument(STREAMING_MODES_SOURCE, mockTranslate);
        const lines = result.split("\n");

        // Table separator should be preserved exactly
        const separatorLine = lines.find((line) => /^\| -/.test(line));
        expect(separatorLine).toBeDefined();

        // Table header should preserve inline code
        const headerLine = lines.find((line) => line.includes("`off`") && line.includes("`partial`") && line.includes("|"));
        expect(headerLine).toBeDefined();
        expect(headerLine).toContain("`off`");
        expect(headerLine).toContain("`partial`");
        expect(headerLine).toContain("`block`");
        expect(headerLine).toContain("`progress`");

        // Table data rows should preserve structure
        const telegramRow = lines.find((line) => line.includes("✅") && line.includes("|") && line.includes("`partial`"));
        expect(telegramRow).toBeDefined();
        // Should still be a valid table row (starts and ends with |)
        expect(telegramRow!.trim()).toMatch(/^\|.*\|$/);
    });

    it("should preserve inline code in complex list items", async () => {
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => `[ZH]${line}`).join("\n");
        });

        const result = await translateMarkdownDocument(STREAMING_MODES_SOURCE, mockTranslate);
        const lines = result.split("\n");

        // "- `channels.slack.nativeStreaming` toggles..." should keep inline code
        const nativeStreamingLine = lines.find((line) => line.includes("`channels.slack.nativeStreaming`"));
        expect(nativeStreamingLine).toBeDefined();
        expect(nativeStreamingLine).toContain("`channels.slack.nativeStreaming`");
        expect(nativeStreamingLine).toContain("`streaming=partial`");
        expect(nativeStreamingLine).toContain("`true`");

        // "- Uses Bot API `sendMessage` + `editMessageText`." should keep inline code
        const botApiLine = lines.find((line) => line.includes("`sendMessage`"));
        expect(botApiLine).toBeDefined();
        expect(botApiLine).toContain("`sendMessage`");
        expect(botApiLine).toContain("`editMessageText`");

        // "- `block` mode uses draft chunking (`draftChunk`)."
        const draftChunkLine = lines.find((line) => line.includes("`draftChunk`"));
        expect(draftChunkLine).toBeDefined();
        expect(draftChunkLine).toContain("`block`");
        expect(draftChunkLine).toContain("`draftChunk`");
    });

    it("should preserve Canonical key inline code", async () => {
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => `[ZH]${line}`).join("\n");
        });

        const result = await translateMarkdownDocument(STREAMING_MODES_SOURCE, mockTranslate);
        const lines = result.split("\n");

        // "Canonical key: `channels.<channel>.streaming`" should keep inline code
        const canonicalLine = lines.find((line) => line.includes("`channels.<channel>.streaming`"));
        expect(canonicalLine).toBeDefined();
        expect(canonicalLine).toContain("`channels.<channel>.streaming`");
    });

    it("should translate text portions while keeping inline code", async () => {
        // Simulate a real translation that translates text but not code
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => {
                // Simple mock: replace known English words
                return line
                    .replace("disable preview streaming.", "禁用预览流。")
                    .replace("Preview streaming modes", "预览流模式")
                    .replace("Channel mapping", "频道映射")
                    .replace("Runtime behavior", "运行时行为")
                    .replace("Modes:", "模式：")
                    .replace("Slack-only:", "仅Slack：")
                    .replace("Telegram:", "Telegram：")
                    .replace("Discord:", "Discord：")
                    .replace("Slack:", "Slack：");
            }).join("\n");
        });

        const result = await translateMarkdownDocument(STREAMING_MODES_SOURCE, mockTranslate);
        const lines = result.split("\n");

        // Heading should be translated
        expect(lines[0]).toBe("## 预览流模式");

        // List item with inline code: text translated, code preserved
        const offLine = lines.find((line) => line.includes("`off`") && line.includes("禁用预览流"));
        expect(offLine).toBeDefined();
        expect(offLine).toMatch(/^- /);
        expect(offLine).toContain("`off`");
    });
});

// ── Table cell translation and post-table alignment ──────────────────────

describe("translateMarkdownDocument with table cells and post-table content", () => {
    const TABLE_WITH_CONTENT_SOURCE = `### C. Comparison with Prior Art

Table comparing existing methods:

| Method | Year | Approach | Limitation |
|--------|------|----------|------------|
| Method A [1] | 2020 | Description | Issue |
| Method B [2] | 2021 | Description | Issue |
| Method C [3] | 2023 | Description | Issue |

## III. METHODOLOGY

### A. Problem Formulation`;

    it("should preserve line count with table and post-table content", async () => {
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => `[ZH]${line}`).join("\n");
        });

        const result = await translateMarkdownDocument(TABLE_WITH_CONTENT_SOURCE, mockTranslate);
        expect(result.split("\n").length).toBe(TABLE_WITH_CONTENT_SOURCE.split("\n").length);
    });

    it("should translate all table cells correctly", async () => {
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => {
                return line
                    .replace("Method", "方法")
                    .replace("Year", "年份")
                    .replace("Approach", "方法论")
                    .replace("Limitation", "局限性")
                    .replace("Description", "描述")
                    .replace("Issue", "问题");
            }).join("\n");
        });

        const result = await translateMarkdownDocument(TABLE_WITH_CONTENT_SOURCE, mockTranslate);
        const lines = result.split("\n");

        // Table header row: all cells should be translated
        const headerLine = lines[4];
        expect(headerLine).toContain("方法");
        expect(headerLine).toContain("年份");
        expect(headerLine).toContain("方法论");
        expect(headerLine).toContain("局限性");
        // Should still be a valid table row
        expect(headerLine.trim()).toMatch(/^\|.*\|$/);

        // Table separator should be preserved exactly
        expect(lines[5]).toBe("|--------|------|----------|------------|");

        // Data rows should have all cells translated
        const dataRow1 = lines[6];
        expect(dataRow1).toContain("方法 A [1]");
        expect(dataRow1).toContain("2020");
        expect(dataRow1).toContain("描述");
        expect(dataRow1).toContain("问题");
        expect(dataRow1.trim()).toMatch(/^\|.*\|$/);
    });

    it("should NOT misalign content after table rows", async () => {
        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => {
                return line
                    .replace("C. Comparison with Prior Art", "C. 与现有技术的比较")
                    .replace("Table comparing existing methods:", "比较现有方法的表格：")
                    .replace("III. METHODOLOGY", "III. 方法论")
                    .replace("A. Problem Formulation", "A. 问题表述");
            }).join("\n");
        });

        const result = await translateMarkdownDocument(TABLE_WITH_CONTENT_SOURCE, mockTranslate);
        const lines = result.split("\n");

        // Post-table headings should be correctly aligned, NOT shifted
        // Line 10 should be "## III. 方法论" (not table cell content)
        expect(lines[10]).toBe("## III. 方法论");
        // Line 12 should be "### A. 问题表述" (not table cell content)
        expect(lines[12]).toBe("### A. 问题表述");

        // Heading at line 0 should be translated
        expect(lines[0]).toBe("### C. 与现有技术的比较");

        // Paragraph at line 2 should be translated
        expect(lines[2]).toBe("比较现有方法的表格：");
    });

    it("should handle table with mixed translatable and non-translatable cells", async () => {
        const source = `| Name | Code | Value |
|------|------|-------|
| Alpha | \`A\` | 100 |
| Beta | \`B\` | 200 |

Next section here.`;

        const mockTranslate = jest.fn().mockImplementation(async (text: string) => {
            return text.split("\n").map((line) => `[ZH]${line}`).join("\n");
        });

        const result = await translateMarkdownDocument(source, mockTranslate);
        const lines = result.split("\n");

        // Line count preserved
        expect(lines.length).toBe(source.split("\n").length);

        // Inline code in table cells preserved
        const alphaRow = lines[2];
        expect(alphaRow).toContain("`A`");
        expect(alphaRow.trim()).toMatch(/^\|.*\|$/);

        // Post-table content correctly aligned
        expect(lines[5]).toBe("[ZH]Next section here.");
    });
});
