/**
 * @lankajs/async — primitives for "which answer may be trusted" and "how many
 * requests actually leave".
 *
 * A module, not a plugin: core calls nothing here; a ViewModel does.
 *
 * Three residents, none replacing another. The guard makes a burst CORRECT
 * (which answer may be written to state), the coalescer makes it CHEAP (how many
 * requests leave), `LankaPolling` fetches what nobody pushes.
 */

export { LankaPolling } from "./polling/lanka-polling/LankaPolling";
export { createLankaPolling } from "./_factories/create-lanka-polling/createLankaPolling";
export type { ILankaPollingConfig } from "./polling/_interfaces/ILankaPollingConfig";
export type { TLankaPollingCallback } from "./polling/_types/TLankaPollingCallback";
export { createLankaLatestGuard } from "./_factories/create-lanka-latest-guard/createLankaLatestGuard";
export type {
	ILankaLatestGuard,
	TLankaLatestToken,
} from "./_factories/create-lanka-latest-guard/createLankaLatestGuard";
export { createLankaBurstCoalescer } from "./_factories/create-lanka-burst-coalescer/createLankaBurstCoalescer";
export type { ILankaBurstCoalescer } from "./_factories/create-lanka-burst-coalescer/createLankaBurstCoalescer";
export { safeFireAndForget } from "./_utils/safe-fire-and-forget/safeFireAndForget";
