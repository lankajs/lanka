/// <reference types="vite/client" />

/**
 * What this application reads out of its environment, declared.
 *
 * Without this the variables still WORK and are still `any`: vite's own
 * `ImportMetaEnv` carries an `[key: string]: any` index signature, so every name
 * an application adds is typed by that signature rather than by anything. A
 * declared property beats an index signature, which is what makes this file do
 * something — `import.meta.env.VITE_ATLAS_API` becomes a `string | undefined`
 * that has to be defaulted, instead of an `any` that silently becomes whatever
 * it is passed to.
 *
 * `?` rather than `string`, because neither is set in a checkout. Typing an
 * absent variable as present is how a missing environment turns into
 * `undefined` reaching a URL and a request to `"undefined/missions"`.
 */
interface ImportMetaEnv {
	/** `VITE_` is vite's prefix for a variable that may reach the browser. */
	readonly VITE_ATLAS_API?: string;
	/**
	 * The storage secret. Prefixed, therefore PUBLIC — it is shipped in the
	 * bundle, and the encrypted store's threat model says so: it defends against
	 * a person reading `localStorage`, not against a person reading the
	 * application they were served.
	 */
	readonly VITE_ATLAS_SECRET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
