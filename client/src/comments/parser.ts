import * as vscode from 'vscode';
import { Configuration } from './configuration';

export class Parser {
    private ranges: Array<vscode.Range> = [];
    private expression: string = "";

    private delimiter: string = "";
    private blockCommentStart: string = "";
    private blockCommentEnd: string = "";

    private includeSingleLineComments = true;
    private includeMultilineComments = true;
    private includeJSDoc = false;

    // * this will allow plaintext files
    private isPlainText = false;

    // * this is used to prevent the first line of the file (specifically python) from coloring like other comments
    private ignoreFirstLine = false;

    // * this is used to trigger the events when a supported language code is found
    public supportedLanguage = true;

    // The configuration necessary to find supported languages on startup
    private configuration: Configuration;

    /**
     * Creates a new instance of the Parser class
     * @param configuration 
     */
    public constructor(config: Configuration) {

        this.configuration = config;
    }

    /**
     * Sets the regex to be used by the matcher based on the config specified in the package.json
     * @param languageCode The short code of the current language
     * https://code.visualstudio.com/docs/languages/identifiers
     */
    public SetRegex(languageCode: string) {
        this.setDelimiter(languageCode);

        // if the language isn't supported, we don't need to go any further
        if (!this.supportedLanguage) {
            return;
        }

        if (this.isPlainText) {
            // start by tying the regex to the first character in a line
            this.expression = "(^)+([ \\t]*[ \\t]*)";
        } else {
            // start by finding the delimiter (//, --, #, ') with optional spaces or tabs
            this.expression = "(" + this.delimiter + ")+( |\t)*";
        }
        this.expression += "(.*)";
    }

    /**
     * Finds all single line comments delimited by a given delimiter and matching tags specified in package.json
     * @param activeEditor The active text editor containing the code document
     */
    public FindSingleLineComments(activeEditor: vscode.TextEditor): void {
        if (!this.includeSingleLineComments) return;

        let text = activeEditor.document.getText();

        // if it's plain text, we have to do mutliline regex to catch the start of the line with ^
        let regexFlags = (this.isPlainText) ? "igm" : "ig";
        let regEx = new RegExp(this.expression, regexFlags);

        let match: any;
        while (match = regEx.exec(text)) {
            let startPos = activeEditor.document.positionAt(match.index + match[1].length);
            let endPos = activeEditor.document.positionAt(match.index + match[0].length);

            // Required to ignore the first line of .py files (#61)
            if (this.ignoreFirstLine && startPos.line === 0 && startPos.character === 0) {
                continue;
            }
            this.ranges.push(new vscode.Range(startPos, endPos));
        }
    }

    /**
     * Finds block comments as indicated by start and end delimiter
     * @param activeEditor The active text editor containing the code document
     */
    public FindBlockComments(activeEditor: vscode.TextEditor): void {
        if (!this.includeMultilineComments) return;
        
        let text = activeEditor.document.getText();

        let commentMatchString = /^([ \n\t\/\*]*)([^\r\n]*)$/;

        // Use start and end delimiters to find block comments
        let regexString = "(^|[ \t])(";
        regexString += this.blockCommentStart;
        regexString += ")+([\\s\\S]*?)(";
        regexString += this.blockCommentEnd;
        regexString += ")";

        let regEx = new RegExp(regexString, "gm");
        let commentRegEx = new RegExp(commentMatchString, "igm");
        let testDelimiter = new RegExp(this.delimiter, "igm");

        // Find the multiline comment block
        let match: any;
        while (match = regEx.exec(text)) {
            let commentBlock: string = match[0];
            
            // if(testDelimiter.test(commentBlock)) {
            //     let ps = activeEditor.document.positionAt(match.index);
            //     let pe = activeEditor.document.positionAt(match.index + commentBlock.length);
            //     let range = new vscode.Range(ps, pe);
            //     this.ranges = this.ranges.filter(x => !range.contains(x.start));
            // }

            // Find the line
            let line;
            while (line = commentRegEx.exec(commentBlock)) {
                let startPos = activeEditor.document.positionAt(match.index + line.index + line[1].length);
                let endPos = activeEditor.document.positionAt(match.index + line.index + line[0].length);
                if(line[2].length > 0) {
                    this.ranges.push(new vscode.Range(startPos, endPos));

                }
            }
        }
    }

    /**
     * Finds all multiline comments starting with "*"
     * @param activeEditor The active text editor containing the code document
     */
    public FindJSDocComments(activeEditor: vscode.TextEditor): void {

        // If highlight multiline is off in package.json or doesn't apply to his language, return
        if (!this.includeMultilineComments && !this.includeJSDoc) return;

        let text = activeEditor.document.getText();

        // Combine custom delimiters and the rest of the comment block matcher
        let commentMatchString = "(^)+([ \\t]*\\*[ \\t]*)"; // Highlight after leading *
        let regEx = /(^|[ \t])(\/\*\*)+([\s\S]*?)(\*\/)/gm; // Find rows of comments matching pattern /** */

        commentMatchString += "([ ]*|[:])+([^*/][^\\r\\n]*)";

        let commentRegEx = new RegExp(commentMatchString, "igm");

        // Find the multiline comment block
        let match: any;
        while (match = regEx.exec(text)) {
            let commentBlock = match[0];

            // Find the line
            let line;
            while (line = commentRegEx.exec(commentBlock)) {
                let startPos = activeEditor.document.positionAt(match.index + line.index + line[2].length);
                let endPos = activeEditor.document.positionAt(match.index + line.index + line[0].length);
                this.ranges.push(new vscode.Range(startPos, endPos));
            }
        }
    }

    public getRangesWithoutDuplicates() {
        let res : vscode.Range[] = [];
        let duplicates = this.ranges.filter(x => this.ranges.some(y => y.start.isEqual(x.start) && y !== x));
        for (const item of duplicates) {
            if(!res.some(x => x.start.isEqual(item.start)))
                res.push(item);
        }
        return this.ranges.filter(x => !this.ranges.some(y => y.contains(x.start) && y !== x)).concat(res);
    }

    //#region  Private Methods

    /**
     * Sets the comment delimiter [//, #, --, '] of a given language
     * @param languageCode The short code of the current language
     * https://code.visualstudio.com/docs/languages/identifiers
     */
    private setDelimiter(languageCode: string): void {
        this.supportedLanguage = false;
        this.ignoreFirstLine = false;
        this.isPlainText = false;

        const config = this.configuration.GetCommentConfiguration(languageCode);
        if (config) {
            let blockCommentStart = config.blockComment ? config.blockComment[0] : null;
            let blockCommentEnd = config.blockComment ? config.blockComment[1] : null;

            this.setCommentFormat(config.lineComment || blockCommentStart, blockCommentStart, blockCommentEnd);

            this.supportedLanguage = true;
        }

        switch (languageCode) {
            case "apex":
            case "javascript":
            case "javascriptreact":
            case "typescript":
            case "typescriptreact":
                this.includeJSDoc = true;
                break;

            case "elixir":
            case "python":
            case "tcl":
                this.ignoreFirstLine = true;
                break;
            
            case "plaintext":
                this.isPlainText = true;
                break;
        }
    }

    /**
     * Escapes a given string for use in a regular expression
     * @param input The input string to be escaped
     * @returns {string} The escaped string
     */
    private escapeRegExp(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
        // return input.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    /**
     * Set up the comment format for single and multiline highlighting
     * @param singleLine The single line comment delimiter. If NULL, single line is not supported
     * @param start The start delimiter for block comments
     * @param end The end delimiter for block comments
     */
    private setCommentFormat(
            singleLine: string | string[] | null,
            start: string | null = null,
            end: string | null = null): void {

        this.delimiter = "";
        this.blockCommentStart = "";
        this.blockCommentEnd = "";

        // If no single line comment delimiter is passed, single line comments are not supported
        if (singleLine) {
            if (typeof singleLine === 'string') {
                this.delimiter = this.escapeRegExp(singleLine).replace(/\//ig, "\\/");
            }
            else if (singleLine.length > 0) {
                // * if multiple delimiters are passed, the language has more than one single line comment format
                var delimiters = singleLine
                            .map(s => this.escapeRegExp(s))
                            .join("|");
                this.delimiter = delimiters;
            }
        }
        else {
            this.includeSingleLineComments = false;
        }

        if (start && end) {
            this.blockCommentStart = this.escapeRegExp(start);
            this.blockCommentEnd = this.escapeRegExp(end);
        }
    }

    //#endregion
}
