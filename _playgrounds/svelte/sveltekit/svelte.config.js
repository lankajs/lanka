import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/**
 * The compiler's settings, the adapter that decides what a build produces, and
 * the one alias this application adds.
 *
 * `adapter-node` rather than `adapter-auto`: this application is here to show a
 * SERVER scoping an instance per request, and `auto` resolves to whatever
 * platform the build happens to run on — which on a laptop is nothing, and in CI
 * is a guess. A node server is the one target where the thing being demonstrated
 * is visible.
 *
 * `kit.alias` and NOT `paths` in `tsconfig.json`, which is how every other
 * application here declares `@lanka_di`. Kit GENERATES its tsconfig and warns
 * that a hand-written `paths` fights the generated one; declaring the alias here
 * makes Kit write it into both the build and the types, which is one answer
 * instead of two that drift.
 */
export default {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: { "@lanka_di": "./.lanka", "@lanka_di/*": "./.lanka/*" },
	},
};
