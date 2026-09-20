import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";
import type { ILankaVMConfig } from "lanka/viewmodel";
import type { TLankaAngularCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";

export function createLankaVM<State extends object, Actions extends object>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Record<string, never>>,
): TLankaAngularCallableVM<
	ReturnType<
		typeof createCoreLankaVM<State, Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Services>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, Record<string, never>, Services>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Record<string, never>>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Record<string, never>>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Services>>
>;

/**
 * `createLankaVM`, with Angular's read already on it.
 *
 * ```ts
 * // one import line apart from the framework-free declaration, and nothing else
 * import { createLankaVM } from "@lankajs/angular";
 *
 * export const todoVM = createLankaVM<ITodoState, ITodoActions>({ … });
 * ```
 *
 * ```ts
 * @Component({ template: `<p>{{ state().todos.length }}</p>` })
 * export class TodoScreen {
 * 	protected readonly state = todoVM();
 * 	protected readonly count = todoVM((state) => state.todos.length);
 * }
 *
 * todoVM.getState().todos; // outside a component, as always
 * ```
 *
 * ## Why the name is core's name
 *
 * It is the same factory and the same config — the whole difference is which
 * package it was imported from, and that difference is what a reader of the
 * import line already sees. A second name would have made every consuming file
 * say twice what one line says once, and a codebase moving off Angular would
 * have had to rewrite its declarations rather than its imports.
 *
 * That is also why this is not an idiom of `@lankajs/angular`: all five bindings
 * publish these six names, so the shelf stays parallel and the guide stays one
 * guide. What differs between members is what the call ANSWERS — a `Signal`
 * here, a `ShallowRef` in Vue, the state itself in React — which is the same
 * thing that already differs about `useLankaVM`.
 *
 * ## The DECLARATION needs no injection context
 *
 * What is pre-applied is `useLankaVM`, not `toLankaSignals`: the assertion runs
 * per CALL, inside the component, and a module-level `export const` builds a
 * Proxy and nothing else. `toLankaSignals` applied here would have thrown at
 * import time, which is the defect this shape exists to avoid.
 *
 * ## What it does NOT do
 *
 * It is core's factory with `useLankaVM` on the result and nothing besides.
 * There is one store, built by core; a ViewModel declared through this and the
 * same ViewModel declared through `lanka/viewmodel` answer identically, notify
 * identically and dispose identically — and `toLankaSignals` and
 * `toLankaObservable` both take this one, because the ViewModel's members are
 * forwarded onto it.
 */
export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaVMConfig<State, Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreLankaVM<State, Actions, TGateways, Services>(config));
}
