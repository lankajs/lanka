/**
 * `@lankajs/solid` — how a Solid component reads a lanka ViewModel.
 *
 * One name, `useLankaVM`, and it is the same name every member of
 * `modules/bindings/` publishes. What differs is what the call answers — an
 * `Accessor` here, a `ShallowRef` in Vue, the state itself in React — because
 * that is the framework's own reactivity and the one thing a binding cannot
 * abstract away.
 */

export { toLankaSolidVM } from "./to-lanka-solid-vm/toLankaSolidVM";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type { TLankaSolidVM } from "./to-lanka-solid-vm/toLankaSolidVM";
export type { TLankaVMAccessor } from "./use-lanka-vm/useLankaVM";
