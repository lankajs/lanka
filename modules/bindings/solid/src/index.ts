/**
 * `@lankajs/solid` — how a Solid component reads a lanka ViewModel.
 *
 * One name, `useLankaVM`, and it is the same name every member of
 * `modules/bindings/` publishes. What differs is what the call answers — an
 * `Accessor` here, a `ShallowRef` in Vue, the state itself in React — because
 * that is the framework's own reactivity and the one thing a binding cannot
 * abstract away.
 *
 * It also publishes core's six ViewModel factories under CORE'S OWN NAMES, each
 * already wearing Solid's read — so a declaration moves from the framework-free
 * spelling to this one by changing the import line and nothing else. Every
 * member of this shelf publishes the same six, which is why they are not idioms
 * of this package: what differs is what the call ANSWERS, exactly as it already
 * does for `useLankaVM`. What is pre-applied is `useLankaVM` and not
 * `toLankaSolidVM`, because a factory answers at the DECLARATION where there is
 * no owner, and the call answers inside the component where there is one.
 *
 * `toLankaSolidVM` is unaffected by any of that. It keeps its own name, it must
 * still be called inside an owner — it opens a signal and an `onCleanup` — and
 * it accepts what these six factories answer, because the ViewModel's own
 * members are forwarded onto the result.
 */

export { createLankaVM } from "./_factories/create-lanka-vm/createLankaVM";
export { createLazyLankaVM } from "./_factories/create-lazy-lanka-vm/createLazyLankaVM";
export { createLazySharedStoreLankaVM } from "./_factories/create-lazy-shared-store-lanka-vm/createLazySharedStoreLankaVM";
export { createLazyStatelessLankaVM } from "./_factories/create-lazy-stateless-lanka-vm/createLazyStatelessLankaVM";
export { createSharedStoreLankaVM } from "./_factories/create-shared-store-lanka-vm/createSharedStoreLankaVM";
export { createStatelessLankaVM } from "./_factories/create-stateless-lanka-vm/createStatelessLankaVM";
export { toLankaSolidVM } from "./to-lanka-solid-vm/toLankaSolidVM";
export { toLankaCallableVM } from "./to-lanka-callable-vm/toLankaCallableVM";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type { TLankaSolidCallableVM } from "./to-lanka-callable-vm/toLankaCallableVM";
export type { TLankaSolidVM } from "./to-lanka-solid-vm/toLankaSolidVM";
export type { TLankaVMAccessor } from "./use-lanka-vm/useLankaVM";
