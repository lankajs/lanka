/**
 * What a `.vue` file is, to anything that is not the Vue compiler.
 *
 * TypeScript reads a single-file component through `vue-tsc`, which understands
 * the format. Everything ELSE that reads this project — plain `tsc`, eslint's
 * type service, an editor without the Vue plugin — sees a file extension it has
 * no rule for and refuses the import outright.
 *
 * This declares the shape they all agree on: an SFC's default export is a Vue
 * component. It is narrower than `any` and wider than the component's real
 * props, which is the trade a shim makes — `vue-tsc` still checks the props at
 * every call site, and this only stops the import itself from being an error.
 */
declare module "*.vue" {
	import type { DefineComponent } from "vue";

	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;

	export default component;
}
