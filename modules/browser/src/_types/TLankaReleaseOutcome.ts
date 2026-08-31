/**
 * What the guard found, so the application can decide what to do about it.
 *
 * Returned rather than acted on: reloading the page is the commonest answer and
 * the worst default — a visitor mid-form would lose it.
 */
export type TLankaReleaseOutcome = "released" | "unchanged" | "unknown";
