import { createLanka } from "../_factories/create-lanka/createLanka";
import { createLankaHost } from "../../config/_factories/create-lanka-host/createLankaHost";
import type { ILankaHost } from "../../config/_interfaces/ILankaHost";
import type { ILankaInstance } from "../_factories/create-lanka/createLanka";
import type { TLankaStartConfig } from "../_types/TLankaStartConfig";

/** The host as given, or one built from the base URL. */
const hostOf = (config: TLankaStartConfig): ILankaHost =>
	config.host ?? createLankaHost({ apiBaseUrl: config.apiBaseUrl, ...config.messages });

/**
 * A started framework, in one call.
 *
 * ```ts
 * const lanka = await startLanka({ apiBaseUrl: "https://api.example.com" });
 * const sameOrigin = await startLanka(); // nothing to configure yet
 * ```
 *
 * ## What it saves, and what it does not hide
 *
 * `createLanka` already activates the instance it returns, and `bootstrap` already
 * brings up the scenario layer — so an application's whole start-up was two calls
 * and a `for` loop over its plugins. This is those, in the order that works, and
 * nothing else: what comes back is the same `ILankaInstance`, with every method
 * it always had.
 *
 * The order matters and is the reason this exists rather than a paragraph in a
 * guide. Plugins install BEFORE bootstrap, because a plugin that adds a
 * bootstrap service after the plan is built adds it to nothing; and bootstrap is
 * awaited, because a screen rendered against a half-started framework fails in
 * the layer it reaches first rather than where the mistake was.
 *
 * An application that needs something between those steps — registering a
 * singleton whose construction reads a service's result, say — writes the two
 * calls out and keeps this one for the next project.
 */
export const startLanka = async (config: TLankaStartConfig = {}): Promise<ILankaInstance> => {
	const lanka = createLanka({ host: hostOf(config), flags: config.flags });

	for (const plugin of config.plugins ?? []) lanka.use(plugin);

	await lanka.bootstrap({ services: config.services, scenarios: config.scenarios });

	return lanka;
};
