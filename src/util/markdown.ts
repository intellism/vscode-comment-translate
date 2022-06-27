
export interface IMarkdownReplceToken {
    text:string;
    ignoreStartStr?:string; // 忽略首字符 * - #
    origin?:string[];
    embed?:boolean;
}

// # xxx
// yyy [hello](http://baidu.com)
// ```js
// var x=1;
// ```
// bbb

// let res:IMarkdownReplceToken[] = [
//     {
//         text:'#xxx'
//     },
//     {
//         text:'yyy {0}',
//         origin:[
//             '[hello](http://baidu.com)'
//         ]
//     },
//     {
//         text:'{0}',
//         origin:[
//             '```js\nvar x=1\n```'
//         ]
//     },
//     {
//         text:'bbb'  
//     }
// ];

export function markdownReplace(text:string) {
    let arr = text.split('\n');
    let res:IMarkdownReplceToken[] = [];
    let embedStart = false;
    let embedArr:string[];
    arr.forEach((originValue)=>{
        let value = originValue.trim();
        
        if(embedStart){
            embedArr.push(originValue);
            // code end
            if(value.indexOf('```')===0) {
                embedStart = false;
                // end embed.
                res.push({
                    text:'{t-0}',
                    embed:true,
                    origin: [embedArr.join('\n')]
                });
            }

            return;
        }
        // code begin
        if(value.indexOf('```')===0) {
            embedStart = true;
            embedArr = [originValue];
            return;
        }
        // value.match(/\[[\s\S]*?\]\([\s\S]*?\)/g);
        let origin:string[] = [];
        let ignoreStartStr:string = '';
        value = originValue.replace(/(\*\*|__)?\!?\[[\s\S]*?\]\([^\)]*?([^()]*\([^\)]*\))*[^\)]*?\)(\*\*|__)?/g, function(substring){
            origin.push(substring);
            return `{t-${origin.length-1}}`;
        });

        let matchValue = value.match(/^[\s]*(#{1,5}|\-|\*|\+|[0-9]+\.)[\s]*/);
        if(matchValue) {
            ignoreStartStr = matchValue[0];
            value = value.slice(ignoreStartStr.length);
        }

        res.push({text:value,origin,ignoreStartStr});
    });
    
    return res;

}


export function markdownRecovery(translateds:string[], tokens:IMarkdownReplceToken[]) {
    let translatedIndex = 0;
    let res = tokens.map((token,index)=>{
        let result='';
        if(token.text.length>0) {
            result = translateds[translatedIndex++];
        }

        if(token.origin) {
            token.origin?.forEach((item,i)=>{
                result = result.replace(`{t-${i}}`, item);
            });
        }
        if(tokens[index].ignoreStartStr) {
            result = tokens[index].ignoreStartStr+result;
        }
        return result;
    });
    return res.join('\n');
}
