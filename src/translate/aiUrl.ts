/**
 * Normalize OpenAI-compatible base URL to an absolute `.../vN` endpoint without a trailing slash.
 * Accepts values with or without scheme (e.g. `api.openai.com`, `127.0.0.1:11434/v1`).
 */
export function normalizeAiBaseUrl(baseUrl: string): string {
    let url = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!url) {
        throw new Error('AI Translate: baseUrl is empty. Set commentTranslate.ai.baseUrl.');
    }

    if (!/^https?:\/\//i.test(url)) {
        url = withDefaultScheme(url);
    }

    if (!/\/v\d+$/i.test(url)) {
        url = `${url}/v1`;
    }
    return url;
}

function withDefaultScheme(schemeLess: string): string {
    const probe = `http://${schemeLess}`;
    try {
        const host = new URL(probe).hostname;
        if (isPrivateOrLocalHost(host)) {
            return probe;
        }
    } catch {
        // fall through to https
    }
    return `https://${schemeLess}`;
}

function isPrivateOrLocalHost(host: string): boolean {
    if (/^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(host)) {
        return true;
    }
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return true;
    }
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return true;
    }
    const m = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (m) {
        const second = Number(m[1]);
        if (second >= 16 && second <= 31) {
            return true;
        }
    }
    return false;
}

/** localhost, loopback, or private LAN hosts where API keys are commonly optional. */
export function isKeyOptionalBaseUrl(baseUrl: string): boolean {
    try {
        const withScheme = /^https?:\/\//i.test(baseUrl)
            ? baseUrl
            : withDefaultScheme(baseUrl.trim().replace(/\/+$/, '') || baseUrl);
        const host = new URL(withScheme).hostname;
        return isPrivateOrLocalHost(host);
    } catch {
        return /localhost|127\.0\.0\.1/i.test(baseUrl);
    }
}
