/**
 * `@lankajs/svelte` — how a Svelte component reads a lanka ViewModel.
 *
 * One name, `useLankaVM`, and it is the same name every member of
 * `modules/bindings/` publishes. What differs is what the call answers — an
 * object of getters here, a `ShallowRef` in Vue, the state itself in React —
 * because that is the framework's own reactivity and the one thing a binding
 * cannot abstract away.
 *
 * No compiler: `createSubscriber` is plain TypeScript, so this package builds
 * with `tsup` like every other one here and a consumer needs no extra plugin
 * beyond the one their Svelte project already has.
 */

export { toLankaSvelteStore } from "./to-lanka-svelte-store/toLankaSvelteStore";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type {
	ILankaSvelteStore,
	TLankaStoreUnsubscriber,
} from "./to-lanka-svelte-store/toLankaSvelteStore";
export type { TLankaVMView } from "./use-lanka-vm/useLankaVM";
