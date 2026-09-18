import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/**
 * The compiler's settings, and there is only one that matters.
 *
 * `vitePreprocess` is what makes `<script lang="ts">` legal: Svelte's compiler
 * reads Svelte, not TypeScript, and without a preprocessor every type annotation
 * in every component is a syntax error. A file at this path is also what
 * `svelte-check` and `eslint-plugin-svelte` look for, which is why it exists as
 * a file rather than as an option inside `vite.config.ts`.
 */
export default { preprocess: vitePreprocess() };
