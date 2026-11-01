// BingTranslate must bound the wait on bing-translate-api, which sets no request
// timeout of its own: a hung request would otherwise block the translation forever.
const mockTranslate = jest.fn();
jest.mock('bing-translate-api', () => ({ translate: (...args: unknown[]) => mockTranslate(...args) }));

import { BingTranslate } from '../../../src/translate/BingTranslate';

describe('BingTranslate', () => {
    afterEach(() => {
        jest.useRealTimers();
        mockTranslate.mockReset();
    });

    test('returns the translation text', async () => {
        mockTranslate.mockResolvedValueOnce({ translation: 'Aktifkan interupsi' });

        const result = await new BingTranslate()._translate('使能中断', { from: 'auto', to: 'id' });

        expect(result).toBe('Aktifkan interupsi');
        expect(mockTranslate).toHaveBeenCalledWith('使能中断', 'auto-detect', 'id');
    });

    test('rejects when the request hangs for more than 10 s', async () => {
        jest.useFakeTimers();
        mockTranslate.mockReturnValueOnce(new Promise(() => { /* never settles */ }));

        const pending = new BingTranslate()._translate('使能中断', { from: 'auto', to: 'id' });
        const assertion = expect(pending).rejects.toThrow('Bing request timed out after 10 s');
        await jest.advanceTimersByTimeAsync(10000);
        await assertion;
    });
});
