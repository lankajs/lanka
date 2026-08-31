import { fileURLToPath } from "node:url";

/**
 * Path to the `.lanka_di` fixture substituted for the consumer's barrels.
 *
 * The framework reads five application barrels through the `@lanka_di` alias. In
 * a real consumer `@lankajs/tool-di` sets that alias; under test the vitest
 * config must set it — and not only for core: any package importing `lanka`
 * pulls in `LankaScenarioBootstrap`, which reads `@lanka_di/Scenarios`.
 *
 * The fixture therefore lives with the test kit, the one package whose job is to
 * serve the others.
 *
 * ```ts
 * import { lankaDiAlias } from "@lankajs/tool-testing/vitest";
 *
 * export default defineConfig({ resolve: { alias: lankaDiAlias() } });
 * ```
 */
export const LANKA_DI_FIXTURE = fileURLToPath(new URL("../_fixtures/.lanka_di", import.meta.url));

export const lankaDiAlias = (): Record<string, string> => ({ "@lanka_di": LANKA_DI_FIXTURE });
