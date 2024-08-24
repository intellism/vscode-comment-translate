
import { CompletionItem, CompletionItemKind, CompletionItemProvider, ExtensionContext, languages, Position, ProviderResult, TextDocument } from "vscode";
import { getVariableCompletions, setCaseGuide } from "../command/replaceSelections";

class VarTranslateCompletionItemProvider implements CompletionItemProvider {
    async provideCompletionItems(document: TextDocument, position: Position) {
        // 不需要触发字符
        // if(context.triggerCharacter) return null;
        let coms = getVariableCompletions(document, new Position(position.line, position.character));
        if(!coms) {
            return null;
        }


        let {range, list,filterText,caseGuide,codeType} = coms;
        let r = range;
        
        let res: CompletionItem[] = list.map((c, index) => {
            let item = new CompletionItem(c.value);
            item.kind = convertKind(codeType);
            item.range = r;
            item.filterText = filterText;
            item.insertText = c.value;
            item.sortText = `${index}`;
            item.detail = `${c.title}`;
            item.documentation = "This is a variable completion item";

            if(caseGuide[codeType] === c.title) {
                item.preselect = true;
            }

            return item;
        });

        return res;
    }

    resolveCompletionItem(item: CompletionItem): ProviderResult<CompletionItem> {
        item.kind&&setCaseGuide(convertCodeType(item.kind), item.detail!);
        return item;
    }
}

export function registerCompletion(context: ExtensionContext, canLanguages: string[] = []) {
    const completionItemProviderDisposable = languages.registerCompletionItemProvider(canLanguages, new VarTranslateCompletionItemProvider());
    context.subscriptions.push(completionItemProviderDisposable);
}



function convertKind(codeType:string) {
    switch(codeType) {
        case 'variable':
            return CompletionItemKind.Variable;
        case 'function':
            return CompletionItemKind.Function;
        case 'class':
            return CompletionItemKind.Class;
        case 'readonly':
            return CompletionItemKind.Constant;
        default:
            return CompletionItemKind.Text;
    }
}

function convertCodeType(kind:CompletionItemKind) {
    switch(kind) {
        case CompletionItemKind.Variable:
            return 'variable';
        case CompletionItemKind.Function:
            return 'function';
        case CompletionItemKind.Class:
            return 'class';
        case CompletionItemKind.Constant:
            return 'readonly';
        default:
            return 'variable';
    }
}