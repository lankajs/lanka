import type { ILankaStorageAdapter } from "lanka/storage";

/**
 * The application: work done on a server that has to outlive the request.
 *
 * The other three members are a device. This one is the case they cannot serve —
 * a render on a server, a queue worker, an edge function — where "storage" is a
 * filesystem or a Redis and the process that reads a value is not the one that
 * wrote it.
 *
 * Everything here is written against the port, so the same code runs over a
 * filesystem in development and a Redis in production by changing which driver
 * was mounted, and over a `Map` in a test by changing nothing at all.
 */
export const createPlaygroundServerSession = (adapter: ILankaStorageAdapter, tenant: string) => {
	// A key with a separator in it, on purpose: this is how an application names
	// things, and unstorage would have turned it into a path.
	const draftKey = (id: string): string => `tenants/${tenant}/drafts/${id}`;

	return {
		save: (id: string, body: string): Promise<void> => adapter.setItem(draftKey(id), body),

		read: (id: string): Promise<string | null> => adapter.getItem(draftKey(id)),

		discard: (id: string): Promise<void> => adapter.removeItem(draftKey(id)),

		/** Every draft this tenant has, by the name the application gave it. */
		drafts: async (): Promise<string[]> => {
			const keys = (await adapter.keys?.()) ?? [];
			return keys.filter((key) => key.startsWith(`tenants/${tenant}/drafts/`)).sort();
		},

		/** The end of everything, which on a server is a deployment and not a sign-out. */
		wipe: (): Promise<void> => adapter.clear(),
	};
};
