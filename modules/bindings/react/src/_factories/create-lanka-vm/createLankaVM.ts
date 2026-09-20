import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { toLankaReactVM } from "../../to-lanka-react-vm/toLankaReactVM";
import type { ILankaVMConfig } from "lanka/viewmodel";
import type { TLankaReactVM } from "../../to-lanka-react-vm/toLankaReactVM";

export function createLankaVM<State extends object, Actions extends object>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Record<string, never>>,
): TLankaReactVM<
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
): TLankaReactVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, Record<string, never>, Services>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Record<string, never>>,
): TLankaReactVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Record<string, never>>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): TLankaReactVM<ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Services>>>;

/**
 * `createLankaVM`, with React's spelling already on it.
 *
 * ```ts
 * // one import line apart from the framework-free declaration, and nothing else
 * import { createLankaVM } from "@lankajs/react";
 *
 * export const useTodoVM = createLankaVM<ITodoState, ITodoActions>({ … });
 * ```
 *
 * ```tsx
 * const { todos, load } = useTodoVM();
 * const count = useTodoVM((state) => state.todos.length);
 * const todos = useTodoVM.getState().todos; // outside a component, as always
 * ```
 *
 * ## Why the name is core's name
 *
 * It is the same factory and the same config — the whole difference is which
 * package it was imported from, and that difference is what a reader of the
 * import line already sees. A second name would have made every consuming file
 * say twice what one line says once, and a codebase moving off React would have
 * had to rewrite its declarations rather than its imports.
 *
 * That is also why this is not an idiom of `@lankajs/react`: all five bindings
 * publish these six names, so the shelf stays parallel and the guide stays one
 * guide. What differs between members is what the call ANSWERS — here a callable
 * ViewModel, in Vue a composable, in Solid a factory per owner — which is the
 * same thing that already differs about `useLankaVM`.
 *
 * ## What it does NOT do
 *
 * It is `toLankaReactVM(createLankaVM(config))` and nothing besides. There is one
 * store, built by core, and the callable is one Proxy over it; a ViewModel
 * declared through this and the same ViewModel declared through `lanka/viewmodel`
 * answer identically, notify identically and dispose identically.
 *
 * ## The one thing to know in a server build
 *
 * This barrel carries `"use client"`, because what it hands back is a hook. A
 * ViewModel a SERVER component must read is therefore declared with core's
 * factory and wrapped where it is rendered — `toLankaReactVM` is exactly that
 * seam, and it stays published for it.
 */
export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaVMConfig<State, Actions, TGateways, Services>) {
	return toLankaReactVM(createCoreLankaVM<State, Actions, TGateways, Services>(config));
}
