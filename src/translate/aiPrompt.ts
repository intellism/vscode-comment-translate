import { LANGS } from '../lang';

const langNameMap = new Map(LANGS);

export type AiTranslateStyle = 'natural' | 'literal' | 'concise';

export function resolveLanguageName(code: string): string {
    if (!code || code === 'auto') {
        return 'auto-detected language';
    }
    return langNameMap.get(code) || code;
}

const STYLE_PROMPTS: Record<AiTranslateStyle, string> = {
    natural: `You are a professional translator for software engineers reading source-code comments and documentation.
Translate with natural, fluent phrasing suitable for quick reading — avoid stiff word-for-word machine translation.
Keep technical terms, identifiers, API names, code snippets, URLs, and text inside backticks unchanged.
Return ONLY the translation. Do not add explanations, labels, or markdown fences.
Preserve line breaks and keep the same number of lines as the input.`,
    literal: `You are a precise translator for software source-code comments.
Stay close to the original wording and structure; prefer literal accuracy over rewriting.
Keep technical terms, identifiers, API names, code snippets, URLs, and text inside backticks unchanged.
Return ONLY the translation. Do not add explanations, labels, or markdown fences.
Preserve line breaks and keep the same number of lines as the input.`,
    concise: `You are a translator for software engineers reading source-code comments in a narrow hover panel.
Produce a concise, fluent translation that preserves meaning with fewer words when possible.
Keep technical terms, identifiers, API names, code snippets, URLs, and text inside backticks unchanged.
Return ONLY the translation. Do not add explanations, labels, or markdown fences.
Preserve line breaks and keep the same number of lines as the input.`,
};

export function getSystemPromptForStyle(style: string, systemPromptOverride?: string): string {
    if (systemPromptOverride && systemPromptOverride.trim()) {
        return systemPromptOverride.trim();
    }
    if (style === 'literal' || style === 'concise' || style === 'natural') {
        return STYLE_PROMPTS[style];
    }
    return STYLE_PROMPTS.natural;
}

export function getAiTranslateMessages(
    content: string,
    from: string,
    to: string,
    options?: { systemPromptOverride?: string; style?: string }
) {
    const targetName = resolveLanguageName(to);
    const sourceName = resolveLanguageName(from);
    const systemPrompt = getSystemPromptForStyle(options?.style || 'natural', options?.systemPromptOverride);
    const userPrompt = `Source language: ${sourceName}
Target language: ${targetName}

Text:
${content}`;

    return {
        systemPrompt,
        userPrompt,
        messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt },
        ],
    };
}

/**
 * Strip common LLM wrappers that break hover / immersive line alignment.
 */
export function cleanAiTranslation(raw: string): string {
    let text = raw.trim();
    if (!text) {
        return '';
    }

    // Full-fence wrap
    const fenceMatch = text.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch) {
        text = fenceMatch[1].trim();
    } else if (text.startsWith('```')) {
        // Opening fence without clean close
        text = text.replace(/^```(?:\w+)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    text = text.replace(/^(?:translation|translated text|here is the translation|译文|翻译结果|翻译)\s*[:：]\s*/i, '');
    return text;
}
