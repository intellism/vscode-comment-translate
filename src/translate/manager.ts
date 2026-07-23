import { ITranslateOptions, TranslateManager } from "comment-translate-manager";
import { getConfig, onConfigChange } from "../configuration";
import { env, ExtensionContext, Memento, workspace } from "vscode";
import { ITranslateConfig, TranslateExtensionProvider } from "./translateExtension";
import { GoogleTranslate } from "./GoogleTranslate";
import { BingTranslate } from "./BingTranslate";
import { detectLanguage } from "../lang";
import { CopilotTranslate } from "./CopilotTranslate";
import { TranSmartTranslate } from "./TranSmartTranslate";
import { AiTranslate } from "./AiTranslate";
import { bumpAiRequestEpoch } from "./aiEpoch";
import { initAiSecrets } from "./aiSecrets";


export let translateManager: TranslateManager;
export let translateExtensionProvider: TranslateExtensionProvider

const sessionTranslateCache = new Map<string, string>();
const pendingTranslateTasks = new Map<string, Promise<string>>();
const MAX_SESSION_CACHE_SIZE = 1000;

const AI_FINGERPRINT_STORAGE_KEY = 'commentTranslate.ai.cacheFingerprint';
let aiWorkspaceStorage: Memento | undefined;

/** Invalidate AI/Copilot caches after SecretStorage key changes (no settings event). */
export function invalidateAiCachesNow() {
    if (aiWorkspaceStorage) {
        invalidateAiCaches(aiWorkspaceStorage);
        return;
    }
    bumpAiRequestEpoch();
    sessionTranslateCache.clear();
}

/**
 * TranslateManager persists results as `${source}-from[...]to[...]-text` in workspaceState
 * without an AI fingerprint. Wipe AI-* entries when model/prompt/baseUrl/etc change.
 */
function clearStoredAiTranslations(storage: Memento) {
    for (const key of storage.keys()) {
        // AI HTTP source and Copilot both consume ai.style / ai.systemPrompt.
        if (key.startsWith('AI-') || key.startsWith('Copilot-')) {
            void storage.update(key, undefined);
        }
    }
}

function syncAiWorkspaceCache(storage: Memento) {
    const current = buildAiCacheFingerprint();
    const stored = storage.get<string>(AI_FINGERPRINT_STORAGE_KEY);
    if (stored !== current) {
        clearStoredAiTranslations(storage);
        void storage.update(AI_FINGERPRINT_STORAGE_KEY, current);
    }
}

function invalidateAiCaches(storage: Memento) {
    bumpAiRequestEpoch();
    sessionTranslateCache.clear();
    clearStoredAiTranslations(storage);
    void storage.update(AI_FINGERPRINT_STORAGE_KEY, buildAiCacheFingerprint());
}

function trimSessionCache() {
    if (sessionTranslateCache.size <= MAX_SESSION_CACHE_SIZE) {
        return;
    }

    const removeCount = sessionTranslateCache.size - MAX_SESSION_CACHE_SIZE;
    let removed = 0;
    for (const key of sessionTranslateCache.keys()) {
        sessionTranslateCache.delete(key);
        removed += 1;
        if (removed >= removeCount) {
            break;
        }
    }
}

function buildAiCacheFingerprint(): string {
    // Include settings that affect output so model/prompt changes do not reuse stale cache entries.
    const model = getConfig<string>('ai.model', '');
    const baseUrl = getConfig<string>('ai.baseUrl', '');
    const preset = getConfig<string>('ai.preset', 'custom');
    const systemPrompt = getConfig<string>('ai.systemPrompt', '');
    const temperature = getConfig<number>('ai.temperature', 0.2);
    const style = getConfig<string>('ai.style', 'natural');
    return `${preset}|${baseUrl}|${model}|${temperature}|${style}|${systemPrompt}`;
}

function buildTranslateCacheKey(text: string, opts?: ITranslateOptions) {
    const sourceProvider = getConfig<string>('source', '');
    const from = opts?.from || translateManager.opts.from || 'auto';
    const to = opts?.to || translateManager.opts.to || 'en';
    // AI HTTP + Copilot share ai.style / ai.systemPrompt — fingerprint both.
    const usesAiPrompt = sourceProvider === 'AI' || sourceProvider === 'Copilot';
    const aiPart = usesAiPrompt ? `|${buildAiCacheFingerprint()}` : '';
    return `${sourceProvider}|${from}|${to}${aiPart}|${text}`;
}

export async function cachedTranslate(text: string, opts?: ITranslateOptions): Promise<string> {
    const key = buildTranslateCacheKey(text, opts);
    if (sessionTranslateCache.has(key)) {
        return sessionTranslateCache.get(key) || '';
    }

    if (pendingTranslateTasks.has(key)) {
        return pendingTranslateTasks.get(key)!;
    }

    const task = translateManager.translate(text, opts)
        .then((result) => {
            sessionTranslateCache.set(key, result);
            trimSessionCache();
            return result;
        })
        .finally(() => {
            pendingTranslateTasks.delete(key);
        });

    pendingTranslateTasks.set(key, task);
    return task;
}

export function initTranslate(context: ExtensionContext) {

    let userLanguage = getUserLanguage();
    const targetLanguage = getConfig('targetLanguage', userLanguage);
    const sourceLanguage = getConfig('sourceLanguage', 'auto');
    initAiSecrets(context.secrets);
    aiWorkspaceStorage = context.workspaceState;
    // 最多单次可以翻译10000字符。 内部会分拆请求翻译服务。
    syncAiWorkspaceCache(context.workspaceState);
    translateManager = new TranslateManager(context.workspaceState, getConfig<number>('maxTranslationLength', 10000), { from: sourceLanguage, to: targetLanguage });
    onConfigChange('maxTranslationLength', (maxLen: number) => {
        translateManager.maxLen = maxLen;
    });
    onConfigChange('targetLanguage', (targetLanguage: string) => {
        translateManager.opts.to = targetLanguage;
        sessionTranslateCache.clear();
        // Note: pendingTranslateTasks are NOT cleared intentionally.
        // In-flight tasks use keys that include the old language code, so they cannot
        // collide with new requests (which use new keys). Clearing would only cause
        // duplicate API calls for any requests that arrive while old tasks are still running.
    });
    onConfigChange('sourceLanguage', (sourceLanguage: string) => {
        translateManager.opts.from = sourceLanguage;
        sessionTranslateCache.clear();
        // See note above regarding pendingTranslateTasks.
    });
    onConfigChange('source', () => {
        sessionTranslateCache.clear();
        // See note above regarding pendingTranslateTasks.
    });
    // AI model / prompt changes must invalidate session + TranslateManager workspace caches.
    workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('commentTranslate.ai')) {
            invalidateAiCaches(context.workspaceState);
        }
    });

    const buildInTranslate: ITranslateConfig[] = [{
        title: 'Google translate',
        ctor: GoogleTranslate,
        translate: 'Google'
    },
    {
        title: 'Bing translate',
        ctor: BingTranslate,
        translate: 'Bing'
    },
    {
        title: 'Github Copilot translate',
        ctor: CopilotTranslate,
        translate: 'Copilot'
    },
    {
        title: 'Tencent TranSmart translate',
        ctor: TranSmartTranslate,
        translate: 'TranSmart'
    },
    {
        title: 'AI Translate (OpenAI Compatible)',
        ctor: AiTranslate,
        translate: 'AI'
    }];
    translateExtensionProvider = new TranslateExtensionProvider(translateManager, buildInTranslate);
    translateExtensionProvider.init(getConfig<string>('source', ''));

    return translateManager;
}


/**
 * Automatic translation, which automatically detects languages based on source code.
 * When `commentTranslate.mutualTranslate` is enabled and the detected language matches
 * the target language, the translation direction is swapped automatically (mutual translate).
 * When disabled, the text is always translated to the configured target language.
 * @param text Text to be translated
 * @param opts Select target and source languages for translation
 * @returns Translated text
 */
export async function autoMutualTranslate(text: string, opts?: ITranslateOptions): Promise<string> {
    let targetLanguage = opts?.to || translateManager.opts.to || 'auto';
    let sourceLanguage = opts?.from || translateManager.opts.from || 'en';

    const isMutualTranslateEnabled = getConfig<boolean>('mutualTranslate', false);
    if (isMutualTranslateEnabled) {
        let detectedLanguage = await detectLanguage(text);
        if (targetLanguage.indexOf(detectedLanguage) === 0) {
            targetLanguage = sourceLanguage;
            // In the case of automatic detection, the target language for translation cannot be auto
            if (targetLanguage === 'auto') targetLanguage = 'en';
        }
    }

    return cachedTranslate(text, { from: opts?.from, to: targetLanguage });
}


export function getUserLanguage() {
    let userLanguage = env.language;

    let langMaps: Map<string, string> = new Map([
        ['zh-cn', 'zh-CN'],
        ['zh-tw', 'zh-TW'],
    ]);
    // 修复语言代码不一致
    if (langMaps.has(userLanguage)) {
        userLanguage = langMaps.get(userLanguage) || '';
    }

    return userLanguage;
}
