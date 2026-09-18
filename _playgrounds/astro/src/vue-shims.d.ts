/**
 * What a `.vue` file is, to a project that has four frameworks in it.
 *
 * This application's `typecheck` is plain `tsc`, and it has to be: `vue-tsc`
 * cannot read a `.svelte` file and neither can read Solid's JSX dialect, so a
 * per-framework compiler here would typecheck one island and skip three.
 *
 * Svelte ships its own `*.svelte` declaration and Solid's dialect is chosen by a
 * per-file `@jsxImportSource` pragma, so Vue is the one that needs a shim. It
 * declares the shape everything agrees on: an SFC's default export is a Vue
 * component. Narrower than `any` and wider than the component's real props,
 * which is the trade a shim makes — the island's OWN suite renders it with real
 * props, and that is where a wrong one is caught.
 */
declare module "*.vue" {
	import type { DefineComponent } from "vue";

	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;

	export default component;
}
