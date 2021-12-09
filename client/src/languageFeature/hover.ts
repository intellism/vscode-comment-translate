import { Hover, languages, MarkdownString, Range } from "vscode";
import { client } from "../extension";


export function registerHover(canLanguages:string[] = []) {

    languages.registerHoverProvider(canLanguages, {
        async provideHover(document, position) {
            let {contents,range} = await client.sendRequest<{
                contents: string[];
                range: Range;
            }>('getHover', {
                textDocument: {
                    uri: document.uri.toString()
                },
                position
            });
            let mds = contents.map(content=>{
                let md = new MarkdownString(content,true);
                md.isTrusted = true;
                return md;
            });
            return new Hover(mds, range);
        }
    });

}
