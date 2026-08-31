/**
 * The default drop: every Cache Storage cache this origin holds.
 *
 * Everything, not a named subset. The framework's own caches
 * (`@lankajs/blob-cache`, the Cache Storage polyfill) are what this exists for,
 * but a build that changed may have changed anything an application cached too —
 * and a half-dropped cache is a page serving two versions at once.
 */
export const dropCacheStorage = async (): Promise<void> => {
	if (typeof caches === "undefined") return;

	const names = await caches.keys();
	await Promise.all(names.map((name) => caches.delete(name)));
};
