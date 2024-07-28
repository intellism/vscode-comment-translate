import { compileBlock, ICommentBlock } from "./compile";

import {
  window,
  Selection,
  DecorationOptions,
  TextEditorDecorationType,
  Disposable,
  TextDocument,
  workspace,
} from "vscode";
import { comment, ctx } from "../extension";
import { usePlaceholderCodeLensProvider } from "./codelen";
import { getConfig, onConfigChange } from "../configuration";

const disposables: Disposable[] = []

let inplace = getConfig<string>('browse.mode', 'contrast') === 'inplace';
let browseEnable = getConfig<boolean>('browse.enabled', true);
let hoverEnable = getConfig<boolean>('hover.enabled', true);
let showBrowser = browseEnable && hoverEnable;

export function showBrowseCommentTranslate() {

  window.onDidChangeTextEditorVisibleRanges(showBrowseCommentTranslateImpl,null,disposables);
  window.onDidChangeTextEditorSelection(updateCommentDecoration,null, disposables);
  window.onDidChangeActiveTextEditor(resetCommentDecoration, null, disposables);
  // TODO 状态过多，变更直接重新绘制好一些。
  onConfigChange('browse.mode', (value: string) => {
    inplace = value === 'inplace';
    resetCommentDecoration();
  }, null, disposables);

  onConfigChange('browse.enabled', (value: boolean) => {
    browseEnable = value;
    showBrowser = browseEnable && hoverEnable;
    resetCommentDecoration();
  }, null, disposables);

  onConfigChange('hover.enabled', (value: boolean) => {
    hoverEnable = value;
    showBrowser = browseEnable && hoverEnable;
    resetCommentDecoration();
  }, null, disposables);

  let timer:any;
  workspace.onDidChangeTextDocument(
    (e) => {
      if (e.document === curr_doc) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          resetCommentDecoration();
        },0);
      }
    },
    null,
    disposables,
  );

  showBrowseCommentTranslateImpl();

  return disposables;
}

class CommentDecoration {
  private _loading: boolean = true;
  private _desposed: boolean = false;
  private _loadingDecoration: TextEditorDecorationType;
  private _translatedDecoration: TextEditorDecorationType | undefined;
  private _contentDecorations: DecorationOptions[]=[];

  constructor(private _block: ICommentBlock, private _languageId:string, private _inplace: boolean = false) {
    this._loadingDecoration = window.createTextEditorDecorationType({
      after: {
        contentIconPath: ctx.asAbsolutePath("resources/icons/loading.svg"),
      },
    });
    this.reflash();
    this.translate();
  }

  get block() {
    return this._block;
  }

  editing() {

    let range = this._block.range;
    let selection = window.activeTextEditor?.selection;
    if(selection) {
        return range.contains(selection);

    }
    return false;
  }

  async translate() {
      let result = await compileBlock(this._block, this._languageId);
      this._loading = false;
  
      let { tokens, range } = this._block;
      let { targets, texts, combined } = result;
  
      if (tokens) {
          let targetIndex = 0;
  
          tokens.forEach((token, i) => {
              let { text, ignoreStart = 0, ignoreEnd = 0 } = token;
              const translateText = texts[i];
              let targetText = translateText.length > 0 ? targets[targetIndex++] : "";
              let offset = i === 0 ? range.start.character : 0;
  
              let combinedIndex = i;

              // 在对比模式下，如果开启多行合并的时候，显示到最后一行
              if(!this._inplace) {
                for (let k = i + 1; k < tokens.length && combined[k]; k++) {
                    combinedIndex = k;
                    // ignoreEnd = tokens[k].ignoreEnd || 0;
                }
              }
              let originText = text.slice(ignoreStart, text.length - ignoreEnd);
  
              // 在对比模式下，翻译结果为空或与原文相同，忽略显示。在占位模式下，需要隐藏原有内容。
              if (this._inplace) {
                  this._contentDecorations.push({
                      range: new Selection(
                          range.start.line + combinedIndex,
                          offset + ignoreStart,
                          range.start.line + combinedIndex,
                          offset + text.length - ignoreEnd
                      ),
                      renderOptions: this.genrateDecorationOptions(targetText),
                  });
              } else if(targetText && targetText !== originText) {
                this._contentDecorations.push({
                    range: new Selection(
                        range.start.line + combinedIndex,
                        offset + ignoreStart,
                        range.start.line + combinedIndex,
                        offset + text.length - ignoreEnd
                    ),
                    renderOptions: this.genrateDecorationOptions(targetText),
                });
              }
          });
  
          this.reflash();
      }
  }

  genrateDecorationOptions(text:string) {

    if(this._inplace) {
        return {
            before: {
              color: `var(--vscode-editorCodeLens-foreground)`,
              contentText: text,
            },
          };
    } 

    return {
        before: {
          textDecoration: `none; font-size: 1em; display: inline-block; position: relative; width: 0; bottom: ${-1.3 }em;`,
          contentText: text,
          color: 'var(--vscode-editorCodeLens-foreground)',
        },
      }

  }

  resetTranslatedDecoration() {
    this._translatedDecoration?.dispose();
    this._translatedDecoration = undefined;
  }

  set inplace(value: boolean) {
    if (this._inplace !== value) {
      this._inplace = value;

      this.resetTranslatedDecoration();
      this.reflash();
    }
  }
  getTranslatedDecoration() {
    
    if(this._translatedDecoration) {
      return this._translatedDecoration;
    }

    let textDecoration: string | undefined;
    if (this._inplace) {
        textDecoration = "none; display: none;";
      }
    this._translatedDecoration = window.createTextEditorDecorationType({
        textDecoration,
      });

      return this._translatedDecoration;
  }

  reflash() {
    // 异步翻译的，重新渲染方法会自己创建对象，这里会出行问题。  TODO 这里不合理，可以通过其他方法思想类似功能
    if(this._desposed) return;
    if (this._loading) {
      window.activeTextEditor?.setDecorations(this._loadingDecoration, [
        this._block.range,
      ]);
    } else {
        window.activeTextEditor?.setDecorations(this._loadingDecoration, []);
    }

    if(this._inplace && this.editing()) {      
        this._translatedDecoration && window.activeTextEditor?.setDecorations(this._translatedDecoration,[]);
        return;
    }

    if(!this._inplace) {
        let {append} = usePlaceholderCodeLensProvider();
        let lines = this._contentDecorations.map((decoration) => decoration.range.start.line+1);
        append(window.activeTextEditor?.document!, lines);
    }

    if (this._contentDecorations.length) {
        let translatedDecoration = this.getTranslatedDecoration();
        window.activeTextEditor?.setDecorations(translatedDecoration,this._contentDecorations);
    }
  }

  dispose() {
    this._desposed = true;
    this._loadingDecoration.dispose();
    this._translatedDecoration?.dispose();
  }
}

let blockMaps: Map<string, CommentDecoration> = new Map();
let curr_doc:TextDocument|undefined;
async function showBrowseCommentTranslateImpl() {

  if(!showBrowser) return;

  let editor = window.activeTextEditor;
  curr_doc = editor?.document;

  if (!editor || !curr_doc) {
    return;
  }

  let blocks = await comment.getAllComment(
    curr_doc,
    "comment",
    editor.visibleRanges[0]
  );
  if (!blocks || blocks.length === 0) return;

  blocks.map((block) => {
    let {start, end} = block.range;
    let key = `${editor.document.uri}~${start.line}:${start.character}-${end.line}:${end.character}`;    
    if(blockMaps.has(key)) {
      return blockMaps.get(key)!;
    }
    let commentDecoration = new CommentDecoration(block,editor?.document.languageId!, inplace);
    blockMaps.set(key, commentDecoration);
    return commentDecoration;
  });
}

function updateCommentDecoration() {
  blockMaps.forEach((value) => {
    value.reflash();
  });
  showBrowseCommentTranslateImpl();
}

function resetCommentDecoration() {
  blockMaps.forEach((value) => {
    value.dispose();
  });
  blockMaps.clear();
  let {cleanAll} = usePlaceholderCodeLensProvider();
  cleanAll();
  curr_doc = undefined;
  showBrowseCommentTranslateImpl();
}