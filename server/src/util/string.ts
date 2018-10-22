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