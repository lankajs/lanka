import { defineNuxtConfig } from "nuxt/config";
import { lankaDiVite } from "../../../tools/di/src/lanka-di-vite/lankaDiVite";

/**
 * Nuxt's build, with the one plugin the framework needs.
 *
 * `lankaDiVite` goes into `vite.plugins` rather than into a Nuxt module,
 * because Nuxt's build IS Vite: the plugin the SPA uses is the plugin this uses,
 * which is the claim `tools/di`'s recipe makes and this file checks.
 *
 * `srcDir: "app"` keeps Nuxt's own directory shape — `app.vue`, `components/` —
 * while `src/` beside it holds the layers `ARCHITECTURE.md` recommends. Two
 * conventions, one application, and the line between them is whose file it is:
 * Nuxt names `app/`, and the consumer names everything else.
 *
 * `defineNuxtConfig` is imported by name rather than left to Nuxt's auto-import,
 * for the reason every other file here does: a name with no import line is a name
 * a reader cannot follow, and here it would also make the typecheck depend on
 * generated files.
 */
export default defineNuxtConfig({
	srcDir: "app",
	serverDir: "server",
	compatibilityDate: "2026-09-15",
	vite: { plugins: [lankaDiVite({ scaffold: !process.env.CI })] },
	typescript: { typeCheck: false },
});
