jest.mock("onigasm/lib/onigasm.wasm", () => {
    return {
        default: "../../node_modules/onigasm/lib/onigasm.wasm",
    };
});

jest.mock("../../src/extension", () => {
    return {
        ctx: {}
    }
});

import * as path from "path";
import { extractGrammarExtensions, readResources } from "../../src/util/ext";
import { TextMateService } from "../../src/syntax/TextMateService";
import { promises as fsPromises } from "fs";

export async function mockGrammarExtensions() {
    const inner = await readResources(path.resolve(__dirname, "../../"));
    let { grammarExtensions } = extractGrammarExtensions(inner, 2);
    return grammarExtensions;
}

export async function mockTextMateService() {
    let grammarExtensions = await mockGrammarExtensions()
    let textMateService = new TextMateService(grammarExtensions);
    return textMateService;
}

export async function getFixtureFile(filePath: string) {
    return fsPromises.readFile(path.resolve(__dirname, "../fixtures/", filePath), 'utf-8')
}
