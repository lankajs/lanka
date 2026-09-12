import { lankaEffectValidator } from "../../src/index";
import { playgroundConfigSchema } from "../playground-config-schema/playgroundConfigSchema";
import type { IPlaygroundConfig } from "../_interfaces/IPlaygroundConfig";

/**
 * Configuration read ONCE, at start-up, and refused loudly.
 *
 * The shape this package is shown in, and it is chosen for what it leaves out.
 * An application on Effect has a runtime; this call has none — no
 * `Effect.runSync`, no `Layer`, no error channel. It is a plain function
 * returning a plain value, which is what every other package in the family
 * returns, and a consumer who wants it inside an Effect wraps it.
 *
 * Only the strict path: a configuration that fails is not a branch to handle.
 * Nothing later in the start-up sequence can do anything useful with half a
 * configuration, and a process that runs on one is a process that fails later,
 * somewhere with less context.
 */
export const readPlaygroundConfig = (raw: unknown): IPlaygroundConfig =>
	lankaEffectValidator.validate(playgroundConfigSchema, raw, "config.startup");
