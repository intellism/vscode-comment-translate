let aiRequestEpoch = 0;

/** Bumped when AI settings change; in-flight requests must discard results. */
export function getAiRequestEpoch(): number {
    return aiRequestEpoch;
}

export function bumpAiRequestEpoch() {
    aiRequestEpoch += 1;
}
