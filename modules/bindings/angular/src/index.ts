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
 *
 * It also re-publishes core's six ViewModel factories under CORE'S OWN NAMES,
 * each already wearing Angular's read — so a declaration moves from the
 * framework-free spelling to this one by changing the import line and nothing
 * else. Every member of this shelf publishes the same six, which is why they are
 * not idioms of this package: what differs is what the call ANSWERS, exactly as
 * it already does for `useLankaVM`.
 *
 * What is pre-applied is `useLankaVM`, so the DECLARATION is safe at module
 * level: the injection context is asserted per CALL, inside the component, where
 * one exists. `toLankaSignals` and `toLankaObservable` are unaffected by any of
 * this — they keep their own names and their own shapes, `toLankaSignals` still
 * requires an injection context of its own, and both accept the result of these
 * six factories, because the ViewModel's members are forwarded onto it.
 */

export { createLankaVM } from "./_factories/create-lanka-vm/createLankaVM";
export { createLazyLankaVM } from "./_factories/create-lazy-lanka-vm/createLazyLankaVM";
export { createLazySharedStoreLankaVM } from "./_factories/create-lazy-shared-store-lanka-vm/createLazySharedStoreLankaVM";
export { createLazyStatelessLankaVM } from "./_factories/create-lazy-stateless-lanka-vm/createLazyStatelessLankaVM";
export { createSharedStoreLankaVM } from "./_factories/create-shared-store-lanka-vm/createSharedStoreLankaVM";
export { createStatelessLankaVM } from "./_factories/create-stateless-lanka-vm/createStatelessLankaVM";
export { toLankaObservable } from "./to-lanka-observable/toLankaObservable";
export { toLankaSignals } from "./to-lanka-signals/toLankaSignals";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type { TLankaAngularCallableVM } from "./_internal/to-lanka-callable-vm/toLankaCallableVM";
export type {
	ILankaObservableVM,
	ILankaObserver,
	ILankaUnsubscribable,
} from "./to-lanka-observable/toLankaObservable";
export type { TLankaSignals } from "./to-lanka-signals/toLankaSignals";
