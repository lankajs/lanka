/**
 * Finds a class in a module's ES namespace by name.
 *
 * An ES namespace is an ordinary object and `module[name]` is enough. Walking
 * `Reflect.ownKeys`, reading property descriptors and wrapping field access in
 * `try/catch` guards against what does not happen.
 *
 * ## Why a fallback pass over `Class.name` is worse than useless
 *
 * It is written for the case where the export name was lost to minification. But
 * `Class.name`.
 *
 * minification loses `Class.name` too — so the fallback looks for something a
 * built bundle no longer has, creating an impression of protection where there
 * is none.
 *
 * Resolution still works when the export name differs from the class name, which
 * `locator.contract.test.ts` pins: the lookup is by EXPORT KEY, and that is what
 * the consumer writes in the barrel.
 */
export function findExportedClass<TInstance>(
	module: object,
	exportName: string,
): (new () => TInstance) | undefined {
	// `in` first, then indexing. An ES namespace answers `undefined` for a missing
	// key, but a mocked module does not: vitest returns a proxy that THROWS on an
	// unknown key.
	if (!(exportName in module)) return undefined;

	// OWN properties only, and `in` alone was not enough. It walks the prototype
	// chain, so `"constructor" in module` is true for any plain object and
	// `module.constructor` is `Object` — a function WITH a prototype, which both
	// checks below accept. The locator would have handed back a class the barrel
	// never exported. `toString` and its siblings only escaped by luck: built-in
	// methods have no `.prototype`.
	//
	// It is asked SECOND, never first: `in` is what tolerates a vitest module
	// proxy, and this narrowing is only ever consulted for a key that already
	// exists. A real ES namespace has a null prototype, so nothing changes there.
	if (!Object.hasOwn(module, exportName)) return undefined;

	const candidate = (module as Record<string, unknown>)[exportName];

	// `typeof === "function"` would also admit a plain function: it has a
	// `prototype` too. They cannot be told apart before calling, and that is a
	// deliberate boundary — the locator trusts the barrel, and `@lankajs/tool-di`
	// verifies the barrel.
	return typeof candidate === "function" && candidate.prototype
		? (candidate as new () => TInstance)
		: undefined;
}
