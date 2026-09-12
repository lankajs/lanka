/**
 * The browser engine a default asks for, or a sentence saying what to pass.
 *
 * `LankaStorage` and `LankaEncryptedStorage` build a browser adapter LAZILY,
 * and only when the application handed them no handler for that space. On a
 * page that getter is right. Off one — React Native, a server, a worker without
 * Cache Storage — it used to reach a global that is not there, and the
 * application got `ReferenceError: localStorage is not defined` from inside a
 * getter it never called by name.
 *
 * The answer is not a fallback. A storage that silently became a `Map` would
 * lose what it was told to keep at the next reload, which is worse than not
 * starting. So this refuses, and the refusal names the fix: hand in a handler.
 *
 * It is also what makes `@lankajs/storage` honest about running outside a
 * browser. `check:runtime` reads a package's source for globals it REQUIRES; a
 * `typeof` is the package asking rather than assuming, and this is where the
 * asking happens.
 */
export const requireWebEngine = <TEngine>(
	engine: TEngine | undefined,
	global: string,
	handler: string,
): TEngine => {
	if (engine !== undefined) return engine;

	throw new Error(
		`This runtime has no \`${global}\`, and no ${handler} handler was given. ` +
			"Pass one — `createLankaMmkvAdapter(engine)` on a device, " +
			"`createLankaUnstorageAdapter(storage)` on a server, or an adapter of your " +
			"own answering `ILankaStorageAdapter`.",
	);
};
