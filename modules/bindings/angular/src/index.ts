/**
 * `@lankajs/angular` — how an Angular component reads a lanka ViewModel.
 *
 * One name, `useLankaVM`, and it is the same name every member of
 * `modules/bindings/` publishes. What differs is what the call answers — a
 * `Signal` here, an `Accessor` in Solid, a `ShallowRef` in Vue, the state itself
 * in React — because that is the framework's own reactivity and the one thing a
 * binding cannot abstract away.
 *
 * It must be called in an injection context, and says so: `DestroyRef` is the
 * only way to learn the caller has gone, and a subscription that cannot learn
 * that is a leak with no owner.
 */

export { toLankaSignals } from "./to-lanka-signals/toLankaSignals";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type { TLankaSignals } from "./to-lanka-signals/toLankaSignals";
