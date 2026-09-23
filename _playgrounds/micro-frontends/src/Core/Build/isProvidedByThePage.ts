import type { TLankaSharing } from "./IMicroFrontendBuild";

/**
 * The UI frameworks, which the page provides whatever the module shares.
 *
 * Not the claim, and external only so that each build takes a second rather
 * than bundling Angular: whether a module ships its own React is a question
 * about React. `rxjs` is here because Angular's own packages import it, and a
 * second copy beside the page's would be Angular's problem, not lanka's.
 */
const FRAMEWORKS = /^(react|react-dom|vue|svelte|rxjs|@angular\/[^/]+)(\/|$)/;

const LANKA = /^lanka(\/|$)/;

/**
 * Whether a bare import is left for the page to provide.
 *
 * The one rule both bundlers apply, so a Vite bundle and a webpack bundle of the
 * same module differ in the bundler and in nothing else — the line below is
 * the whole difference between sharing the page's `lanka` and carrying one.
 */
export const isProvidedByThePage = (request: string, sharing: TLankaSharing): boolean =>
	FRAMEWORKS.test(request) || (sharing === "one-lanka" && LANKA.test(request));
