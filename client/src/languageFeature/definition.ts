import { languages } from "vscode";
import { shortLive } from "./complie";

export function registerDefinition(canLanguages:string[] = []) {
    languages.registerDefinitionProvider(canLanguages, {
        provideDefinition:(document, position)=>{
            shortLive.add({textDocument: {
                uri: document.uri.toString()
            },
            position});
            return null;
        }
    })
}