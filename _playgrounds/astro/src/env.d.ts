/// <reference types="astro/client" />

/**
 * What this application reads out of its environment, declared.
 *
 * Without this the variables still WORK and are still `any`: vite's own
 * `ImportMetaEnv` carries an `[key: string]: any` index signature, so every name
 * an application adds is typed by that signature rather than by anything. A
 * declared property beats an index signature, which is what makes this file do
 * something — `import.meta.env.PUBLIC_ATLAS_API` becomes a `string | undefined`
 * that has to be defaulted, instead of an `any` that silently becomes whatever
 * it is passed to.
 *
 * `?` rather than `string`, because neither is set in a checkout. Typing an
 * absent variable as present is how a missing environment turns into
 * `undefined` reaching a URL and a request to `"undefined/missions"`.
 */
interface ImportMetaEnv {
	/** `PUBLIC_` is Astro's prefix for a variable that may reach the browser. */
	readonly PUBLIC_ATLAS_API?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
