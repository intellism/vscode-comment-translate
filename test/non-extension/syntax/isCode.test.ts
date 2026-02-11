
import { mockTextMateService } from '../mocks';
import { isCode } from '../../../src/syntax/isCode';

describe("isCode", () => {
    let textMateService: any;
    beforeAll(async () => {
        textMateService = await mockTextMateService();
    });

    // --- Basic code detection (should return true) ---
    test("should detect simple code assignment", async () => {
        const result = await isCode(["const x = 1;"], "typescript", textMateService);
        expect(result).toEqual([true]);
    });

    test("should detect function call", async () => {
        const result = await isCode(["console.log('hello');"], "typescript", textMateService);
        expect(result).toEqual([true]);
    });

    test("should detect block of code", async () => {
        const result = await isCode(["function test() { return true; }"], "typescript", textMateService);
        expect(result).toEqual([true]);
    });

    test("should detect code with trailing comment", async () => {
        const result = await isCode(["let a = 10; // assign 10 to a"], "typescript", textMateService);
        expect(result).toEqual([true]);
    });

    // --- Plain text detection (should return false) ---
    test("should NOT detect plain text", async () => {
        const result = await isCode(["This is a plain text comment."], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    test("should NOT detect text with code-like words", async () => {
        const result = await isCode(["The function is used to calculate value."], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    test("should NOT detect full-line comment", async () => {
        const result = await isCode(["// This assigns 10 to a variable named a"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    // --- False positive cases from user ---
    test("should NOT detect 'This value *should* always exist'", async () => {
        const result = await isCode(["This value *should* always exist"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    test("should NOT detect 'if undefined, then we get diff from beginning of git'", async () => {
        const result = await isCode(["if undefined, then we get diff from beginning of git"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    test("should NOT detect 'Communicate with webview'", async () => {
        const result = await isCode(["Communicate with webview"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    test("should NOT detect long English sentence with code keywords", async () => {
        const result = await isCode(["we don't need this anymore since most tasks are now created with checkpoints enabled"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    test("should NOT detect complex English sentence", async () => {
        const result = await isCode(["they are continuing them from the same workspace (which we never tied to tasks, so no way for us to know if it is opened in the right workspace)"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    // --- Special character handling ---
    test("should NOT detect text with contractions (it's)", async () => {
        const result = await isCode(["it's a test"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    test("should NOT detect text with quoted words", async () => {
        const result = await isCode(['"hello world" is a common example'], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    // --- Non-English text ---
    test("should NOT detect Chinese text", async () => {
        const result = await isCode(["这是一个注释"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    test("should NOT detect Japanese text", async () => {
        const result = await isCode(["これはコメントです"], "typescript", textMateService);
        expect(result).toEqual([false]);
    });

    // --- Multi-line ---
    test("should handle multi-line input correctly", async () => {
        const lines = [
            "This is a comment",
            "const x = 1;",
            "Another text comment",
            "function foo() { return bar; }"
        ];
        const result = await isCode(lines, "typescript", textMateService);
        expect(result).toEqual([false, true, false, true]);
    });
});
