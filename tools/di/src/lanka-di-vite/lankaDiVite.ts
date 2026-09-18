import type { Plugin } from "vite";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { lankaDiScaffoldNotice } from "../lanka-di-scaffold-notice/lankaDiScaffoldNotice";
import { lankaDiSetup } from "../lanka-di-setup/lankaDiSetup";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";

/**
 * The consumer side: keeps `.lanka_di` present, correct and reachable through
 * the alias.
 *
 * Three jobs the application would otherwise have to remember:
 *
 * 1. **The alias — three times.** `@lanka_di/*` resolves to `<root>/.lanka_di/*`
 *    without the application writing it into its vite config. The framework
 *    imports through this alias, so getting it wrong is not a lint note but
 *    "module not found" at startup.
 *
 *    The second time is `optimizeDeps.exclude`, and it is the half that fails
 *    SILENTLY. Vite pre-bundles what lives under `node_modules` and follows
 *    aliases while it does, so it walks `lanka`'s dist out through
 *    `@lanka_di` and copies the consumer's own source into
 *    `node_modules/.vite/deps`. That cache is keyed by the lockfile — not by
 *    application source and not by `.env.*` — so the dev server then runs the
 *    copy taken on the day the cache was written and reads that day's
 *    `import.meta.env`. Nothing is reported; the file being executed is simply
 *    not the file being edited.
 *
 *    The ALIAS is excluded and `lanka` is not. An exclude entry matches as a
 *    prefix, so `@lanka_di` covers every barrel and every package that reads
 *    one, present or future, while `lanka` itself stays pre-bundled — which is
 *    what the optimizer is for. Naming `lanka` instead also works, and costs
 *    the dev server a module graph it does not need to fix a problem `lanka`
 *    is not the cause of.
 *
 *    The third time is `ssr.noExternal`, and it is the half that has no
 *    browser in it. Vite externalises anything under `node_modules` for SSR,
 *    and an externalised module is loaded by NODE — which has never heard of
 *    an alias vite invented. `lanka`'s published code then asks node for
 *    `@lanka_di/Gateways` and is told `Cannot find package`, on the server,
 *    in a project whose client half works perfectly. So the framework is
 *    named as one to process rather than hand over. It is the only package
 *    that has to be: everything else reaches the barrels through it.
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
			const { alias } = lankaDiSetup({ ...options, root: configured });
			return {
				resolve: { alias: { ...alias } },

				// The same alias, said to the dependency optimizer — see job 1 above
				// for what happens when it is not. Derived from the same `alias` so
				// the two cannot name different things.
				optimizeDeps: { exclude: Object.keys(alias) },

				// And a third time, to the SSR build — see job 1. An externalised
				// module is loaded by node, which has never heard of this alias.
				ssr: { noExternal: [lankaDiContract.packageName] },
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
