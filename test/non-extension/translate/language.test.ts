// isSameLanguage: decides that text already in the target language needs no translation.
// cld3 often reports Indonesian as Malay ('ms'), so Malay counts as Indonesian.
import { isSameLanguage } from '../../../src/lang';

describe('isSameLanguage', () => {
    test('matches a base code against a regional target', () => {
        expect(isSameLanguage('zh', 'zh-CN')).toBe(true);
        expect(isSameLanguage('en', 'en')).toBe(true);
    });

    test('matches only the same code or a base code followed by a hyphen', () => {
        expect(isSameLanguage('ha', 'haw')).toBe(false);
        expect(isSameLanguage('zh-TW', 'zh')).toBe(false);
        expect(isSameLanguage('haw', 'haw')).toBe(true);
    });

    test('treats Malay as Indonesian for an Indonesian target', () => {
        expect(isSameLanguage('id', 'id')).toBe(true);
        expect(isSameLanguage('ms', 'id')).toBe(true);
    });

    test('keeps different languages apart', () => {
        expect(isSameLanguage('zh', 'id')).toBe(false);
        expect(isSameLanguage('en', 'id')).toBe(false);
        expect(isSameLanguage('ms', 'en')).toBe(false);
    });

    test('never matches an unknown or empty detection', () => {
        expect(isSameLanguage('und', 'id')).toBe(false);
        expect(isSameLanguage('', 'id')).toBe(false);
        expect(isSameLanguage('id', '')).toBe(false);
    });
});
