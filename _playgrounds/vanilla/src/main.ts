import { mountAtlasVanilla } from "./mountAtlasVanilla";

/**
 * The entry the browser loads, and the only file here that touches `window`.
 *
 * Three lines, because everything it needs is a function that takes an element.
 * That is what a framework-free application looks like when the framework under
 * it asks for nothing: no root, no provider, no hydration call.
 */
const root = document.querySelector<HTMLElement>("#atlas");

if (root) {
	void mountAtlasVanilla({ root, apiBaseUrl: "http://127.0.0.1:4380/api" });
}
