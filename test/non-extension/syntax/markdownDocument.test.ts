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
