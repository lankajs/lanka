/**
 * Where a crew member's face lives, from their id.
 *
 * A rule and not a field, because the server derives the bytes from the id and
 * promises they never change — which is the whole reason `createAtlasAvatarCache`
 * may hold them forever without ever asking again. A URL handed over in a payload
 * could be rewritten between two responses, and a cache that never checks
 * freshness would then serve the old face until the tab closed.
 *
 * Framework-free and shared, so five applications cache the same address. Two
 * spellings of this line would be two caches, each holding half the crew.
 */
export const atlasAvatarUrl = (crewId: string): string => `/api/crew/${crewId}/avatar.png`;
