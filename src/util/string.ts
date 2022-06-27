export function isUpperCase(ch: string) {
    return ch >= 'A' && ch <= 'Z'
}

export function isLowerCase(ch: string) {
    return ch >= 'a' && ch <= 'z'
}

export function hasEndMark(ch: string) {
    let lastLineEndCharacter = ch.substring(ch.length - 1);
    return lastLineEndCharacter !== '.';
}


export function hasCode(text:string,symbols:string) {
    for(let symbol of symbols) {
        if(text.indexOf(symbol)>=0) return true;
    }
    return false;
}

export function isCode(text:string) {

    let score = 0;
    if(hasCode(text, '=')){
        score += 10;
    }
    if(hasCode(text, ',')){
        score += 10;
    }
    if(hasCode(text, '{}')){
        score += 10;
    }
    if(hasCode(text, '()')){
        score += 10;
    }
    if(hasCode(text, '<>')){
        score += 10;
    }
    if(hasCode(text, ':.;')){
        score += 10;
    }
    if(hasCode(text, '"\'')) {
        score += 20;
    }
    
    if(text.length >200 && score>40) {
        return true;
    } else if(score>20) {
        return true;
    }

    return false;
}