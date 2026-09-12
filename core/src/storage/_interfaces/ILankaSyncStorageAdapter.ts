/**
 * The half an engine only has when it answers without awaiting.
 *
 * ALL FOUR OR NONE. A caller narrows on three of them and then uses the fourth —
 * an adapter declaring two type-checks and lies at the one call site that has no
 * `await` to fall back to.
 *
 * What it is for: a store read during the first render. `localStorage` and MMKV
 * can answer there; a bridge and a keychain cannot, and a screen that awaits its
 * persisted state renders once without it and again with it — the flash a user
 * reads as a bug.
 */
export interface ILankaSyncStorageAdapter {
	setItemSync(key: string, value: string): void;
	getItemSync(key: string): string | null;
	removeItemSync(key: string): void;
	clearSync(): void;
}
