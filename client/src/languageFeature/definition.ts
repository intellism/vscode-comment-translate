import { ExtensionContext, languages } from "vscode";
import { shortLive } from "./hover";

export function registerDefinition(context: ExtensionContext,canLanguages:string[] = []) {
    const definitionProviderDisposable = languages.registerDefinitionProvider(canLanguages, {
        provideDefinition:(document)=>{
            shortLive.add(document.uri.toString());
            return null;
        }
    });

    context.subscriptions.push(definitionProviderDisposable);
}