import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";
import type { ILankaVMConfig } from "lanka/viewmodel";
import type { TLankaSvelteCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";

export function createLankaVM<State extends object, Actions extends object>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Record<string, never>>,
): TLankaSvelteCallableVM<
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
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, Record<string, never>, Services>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Record<string, never>>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Record<string, never>>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Services>>
>;

/**
 * `createLankaVM`, with Svelte's read already on it.
 *
 * ```ts
 * // one import line apart from the framework-free declaration, and nothing else
 * import { createLankaVM } from "@lankajs/svelte";
 *
 * export const todoVM = createLankaVM<ITodoState, ITodoActions>({ … });
 * ```
 *
 * ```svelte
 * <script lang="ts">
 * 	const state = todoVM();
 * 	const count = todoVM((current) => current.todos.length);
 * </script>
 *
 * {#each state.todos as todo (todo.id)}<li>{todo.title}</li>{/each}
 * <p>{count.current}</p>
 * ```
 *
 * ## Why the name is core's name
 *
 * It is the same factory and the same config — the whole difference is which
 * package it was imported from, and that difference is what a reader of the
 * import line already sees. A second name would have made every consuming file
 * say twice what one line says once, and a codebase moving off Svelte would have
 * had to rewrite its declarations rather than its imports.
 *
 * That is also why this is not an idiom of `@lankajs/svelte`: all five bindings
 * publish these six names, so the shelf stays parallel and the guide stays one
 * guide. What differs between members is what the call ANSWERS — an object of
 * getters here, a plain state in React, a `ShallowRef` in Vue — which is the
 * same thing that already differs about `useLankaVM`.
 *
 * ## What it does NOT do
 *
 * It is `useLankaVM` pre-applied and nothing besides. There is one store, built
 * by core, and the callable is one Proxy over it; a ViewModel declared through
 * this and the same ViewModel declared through `lanka/viewmodel` answer
 * identically, notify identically and dispose identically.
 *
 * `stop()` is on the view the call answers, exactly as it is on `useLankaVM(vm)`
 * — a read taken outside a component owns its subscription here too.
 */
export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaVMConfig<State, Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreLankaVM<State, Actions, TGateways, Services>(config));
}
