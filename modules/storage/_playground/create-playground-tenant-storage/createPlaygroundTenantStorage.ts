import { LankaStorage } from "../../src/index";
import type { ILankaStorageHandler } from "../../src/index";

/** A space of its own: what one tenant wrote, nobody else reads. */
export const createPlaygroundTenantStorage = (tenant: string): LankaStorage => {
	const kept = new Map<string, string>();

	const handler: ILankaStorageHandler = {
		setItem: (key, value) => {
			kept.set(`${tenant}:${key}`, value);
			return Promise.resolve();
		},
		getItem: (key) => Promise.resolve(kept.get(`${tenant}:${key}`) ?? null),
		removeItem: (key) => {
			kept.delete(`${tenant}:${key}`);
			return Promise.resolve();
		},
		clear: () => {
			kept.clear();
			return Promise.resolve();
		},
	};

	// The class, not the ambient instance: this application needs a SECOND
	// storage, which is the thing a namespace of statics could never give it.
	return new LankaStorage({ local: handler, session: handler, cache: handler });
};
