import type { Plugin } from "vite";
import { lankaDiScaffoldNotice } from "../lanka-di-scaffold-notice/lankaDiScaffoldNotice";
import { lankaDiSetup } from "../lanka-di-setup/lankaDiSetup";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";

/**
 * The consumer side: keeps `.lanka_di` present, correct and reachable through
 * the alias.
 *
 * Three jobs the application would otherwise have to remember:
 *
 * 1. **The alias.** `@lanka_di/*` resolves to `<root>/.lanka_di/*` without the
 *    application writing it into its vite config. The framework imports through
 *    this alias, so getting it wrong is not a lint note but "module not found"
 *    at startup.
 * 2. **Scaffolding.** A new consumer gets the barrels written for it — working
 *    and empty — so the application boots before it has its first gateway.
 * 3. **Verification.** A barrel that exists but no longer exports what the
 *    framework calls by name fails the BUILD, naming the file and the symbol,
 *    instead of resolving to `undefined` and failing at runtime inside the
 *    locator, three layers from the cause.
 *
 * The plugin also reads the consumer's `tsconfig.json` and says what to add when
 * a path or an include is missing. That check pays for itself because neither
 * omission fails: TypeScript's wildcard `include` skips dot-directories, and
 * `.lanka_di` compiles without types — silently.
 *
 * The webpack plugin beside it does the same three jobs through webpack's
 * hooks; what they share — the contract, the scaffolder, the verifier — is the
 * package's root entry, and neither bundler is a dependency of the other.
 *
 * @example
 * ```ts
 * import { lankaDiVite } from "@lankajs/tool-di/vite";
 *
 * export default defineConfig({
 *   plugins: [react(), lankaDiVite({ scaffold: !process.env.CI })],
 * });
 * ```
 */
export function lankaDiVite(options: ILankaDiPluginOptions = {}): Plugin {
	let root = options.root ?? process.cwd();

	return {
		name: "lanka:di",

		config(_userConfig, _env) {
			const configured = options.root ?? _userConfig.root ?? process.cwd();
			root = configured;
			return {
				resolve: { alias: { ...lankaDiSetup({ ...options, root: configured }).alias } },
			};
		},

		configResolved(resolved) {
			root = options.root ?? resolved.root;
		},

		buildStart() {
			try {
				const created = lankaDiSetup({ ...options, root }).verify();
				if (created.length > 0) this.warn(lankaDiScaffoldNotice(created));
			} catch (failure) {
				// Reported through vite's own channel, which names the plugin and stops
				// the build — a bare throw would only stop this hook.
				this.error(failure instanceof Error ? failure.message : String(failure));
			}
		},
	};
}
