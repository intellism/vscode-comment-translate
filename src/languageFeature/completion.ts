
import { CompletionItem, CompletionItemKind, CompletionItemProvider, ExtensionContext, languages, MarkdownString, Position, ProviderResult, TextDocument } from "vscode";
import { getVariableCompletionDatas, setCaseGuide } from "../command/replaceSelections";

class VarTranslateCompletionItemProvider implements CompletionItemProvider {
    async provideCompletionItems(document: TextDocument, position: Position) {
        let completionData = getVariableCompletionDatas(document, new Position(position.line, position.character));
        if(!completionData) {
            return null;
        }

        let {range, list,filterText,caseGuide,codeType,value} = completionData;
        let completionItems: CompletionItem[] = list.map((itemData, index) => {
            let item = new CompletionItem(itemData.value);
            item.kind = convertKind(codeType);
            item.range = range;
            item.filterText = filterText;
            item.insertText = itemData.value;
            item.sortText = `${index}`;
            item.detail = `${itemData.title}`;
            item.documentation =new MarkdownString(`Final: \`${itemData.value}\` \n\n ${filterText} => ${value}  `);

            if(caseGuide[codeType] === itemData.title) {
                item.preselect = true;
            }

            return item;
        });

        return completionItems;
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
            return 'text';
    }
}