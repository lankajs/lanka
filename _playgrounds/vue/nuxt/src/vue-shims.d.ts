/**
 * What a `.vue` file is, to anything that is not the Vue compiler.
 *
 * The same shim `_playgrounds/vue/spa` carries, for the same reason: `vue-tsc`
 * reads an SFC and everything else — plain `tsc`, eslint's type service, an
 * editor without the plugin — sees an extension it has no rule for.
 */
declare module "*.vue" {
	import type { DefineComponent } from "vue";

	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;

	export default component;
}
