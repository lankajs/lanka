/// <reference types="vite/client" />

/**
 * What this application reads from its build.
 *
 * Declared rather than assumed: `import.meta.env` is Vite's, and a variable a
 * build did not substitute arrives as `undefined` rather than as an error. The
 * declaration is what makes that visible — `ImportMetaEnv` carries an
 * `[key: string]: any` index signature, so without these lines every name reads
 * as `any` and the `??` beside it looks redundant to a reader and to a linter.
 */
interface ImportMetaEnv {
	readonly VITE_ATLAS_API?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
