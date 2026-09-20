/**
 * `@lankajs/svelte` — how a Svelte component reads a lanka ViewModel.
 *
 * One name, `useLankaVM`, and it is the same name every member of
 * `modules/bindings/` publishes. What differs is what the call answers — an
 * object of getters here, a `ShallowRef` in Vue, the state itself in React —
 * because that is the framework's own reactivity and the one thing a binding
 * cannot abstract away.
 *
 * It also publishes core's six ViewModel factories under CORE'S OWN NAMES, each
 * already wearing this package's read — so a declaration moves from the
 * framework-free spelling to this one by changing the import line and nothing
 * else, same config and same generics. Every member of this shelf publishes the
 * same six, which is why they are not idioms of this package: what differs is
 * what the call ANSWERS, exactly as it already does for `useLankaVM`.
 *
 * `toLankaSvelteVM` is untouched by that and is still how `$store` is spelled.
 * It also accepts what these six factories answer — a callable ViewModel
 * forwards the ViewModel's own `subscribe` — so `$todoVM` and `todoVM()` read
 * the same declaration.
 *
 * No compiler: `createSubscriber` is plain TypeScript, so this package builds
 * with `tsup` like every other one here and a consumer needs no extra plugin
 * beyond the one their Svelte project already has.
 */

export { createLankaVM } from "./_factories/create-lanka-vm/createLankaVM";
export { createLazyLankaVM } from "./_factories/create-lazy-lanka-vm/createLazyLankaVM";
export { createLazySharedStoreLankaVM } from "./_factories/create-lazy-shared-store-lanka-vm/createLazySharedStoreLankaVM";
export { createLazyStatelessLankaVM } from "./_factories/create-lazy-stateless-lanka-vm/createLazyStatelessLankaVM";
export { createSharedStoreLankaVM } from "./_factories/create-shared-store-lanka-vm/createSharedStoreLankaVM";
export { createStatelessLankaVM } from "./_factories/create-stateless-lanka-vm/createStatelessLankaVM";
export { toLankaSvelteVM } from "./to-lanka-svelte-vm/toLankaSvelteVM";
export { toLankaCallableVM } from "./to-lanka-callable-vm/toLankaCallableVM";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type { TLankaSvelteCallableVM } from "./to-lanka-callable-vm/toLankaCallableVM";
export type { ILankaSvelteVM, TLankaVMUnsubscriber } from "./to-lanka-svelte-vm/toLankaSvelteVM";
/**
 * Both arms of what a read answers, because a published type now names both.
 *
 * `TLankaVMSelectedView` was reachable only by inference: `useLankaVM(vm,
 * selector)` answered it and no consumer could write it down. That was survivable
 * while it appeared in one signature. `TLankaSvelteCallableVM` puts it in a
 * PUBLISHED type — this binding is the one whose two arms answer different
 * shapes rather than one container over two payloads — so a consumer annotating
 * a selected read needs the name to exist.
 */
export type { TLankaVMSelectedView, TLankaVMView } from "./use-lanka-vm/useLankaVM";
