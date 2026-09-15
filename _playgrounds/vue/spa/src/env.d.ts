/// <reference types="vite/client" />

/**
 * What this application reads from its build.
 *
 * Declared rather than assumed: `import.meta.env` is Vite's, and a variable a
 * build did not substitute arrives as `undefined` rather than as an error.
 */
interface ImportMetaEnv {
	readonly VITE_ATLAS_API?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
