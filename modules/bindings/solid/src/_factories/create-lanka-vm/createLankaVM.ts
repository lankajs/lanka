import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";
import type { ILankaVMConfig } from "lanka/viewmodel";
import type { TLankaSolidCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";

export function createLankaVM<State extends object, Actions extends object>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Record<string, never>>,
): TLankaSolidCallableVM<
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
): TLankaSolidCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, Record<string, never>, Services>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Record<string, never>>,
): TLankaSolidCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Record<string, never>>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): TLankaSolidCallableVM<ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Services>>>;

/**
 * `createLankaVM`, with Solid's read already on it.
 *
 * ```ts
 * // one import line apart from the framework-free declaration, and nothing else
 * import { createLankaVM } from "@lankajs/solid";
 *
 * export const useTodoVM = createLankaVM<ITodoState, ITodoActions>({ … });
 * ```
 *
 * ```tsx
 * const TodoScreen = () => {
 * 	const state = useTodoVM();
 * 	const count = useTodoVM((todos) => todos.rows.length);
 *
 * 	return <For each={state().rows}>{(row) => <li>{row}</li>}</For>;
 * };
 *
 * const rows = useTodoVM.getState().rows; // outside a component, as always
 * ```
 *
 * ## Why the name is core's name
 *
 * It is the same factory and the same config — the whole difference is which
 * package it was imported from, and that difference is what a reader of the
 * import line already sees. A second name would have made every consuming file
 * say twice what one line says once, and a codebase moving off Solid would have
 * had to rewrite its declarations rather than its imports.
 *
 * That is also why this is not an idiom of `@lankajs/solid`: all five bindings
 * publish these six names, so the shelf stays parallel and the guide stays one
 * guide. What differs between members is what the call ANSWERS — a
 * `TLankaVMAccessor` here, a `ShallowRef` in Vue, the state itself in React —
 * which is the same thing that already differs about `useLankaVM`.
 *
 * ## The read is per CALL, and that is the whole shape
 *
 * What is pre-applied is `useLankaVM`, not `toLankaSolidVM`. A factory answers
 * at the declaration — module level, at import time — and there is no owner
 * there: applying a read eagerly would open one subscription with nobody to
 * release it and hand every component the same one. The call runs inside the
 * component, so each caller gets its own subscription and its own `onCleanup`.
 *
 * ## What it does NOT do
 *
 * It is `toLankaCallableVM(createLankaVM(config))` and nothing besides. There is
 * one store, built by core, and the callable is one Proxy over it; a ViewModel
 * declared through this and the same ViewModel declared through
 * `lanka/viewmodel` answer identically, notify identically and dispose
 * identically — and `toLankaSolidVM` still takes it, because the ViewModel's own
 * members are forwarded onto the result.
 */
export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaVMConfig<State, Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreLankaVM<State, Actions, TGateways, Services>(config));
}
