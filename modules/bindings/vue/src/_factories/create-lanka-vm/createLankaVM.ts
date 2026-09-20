import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";
import type { ILankaVMConfig } from "lanka/viewmodel";
import type { TLankaVueCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";

export function createLankaVM<State extends object, Actions extends object>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Record<string, never>>,
): TLankaVueCallableVM<
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
): TLankaVueCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, Record<string, never>, Services>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Record<string, never>>,
): TLankaVueCallableVM<
	ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Record<string, never>>>
>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): TLankaVueCallableVM<ReturnType<typeof createCoreLankaVM<State, Actions, TGateways, Services>>>;

/**
 * `createLankaVM`, with Vue's read already on it.
 *
 * ```ts
 * // one import line apart from the framework-free declaration, and nothing else
 * import { createLankaVM } from "@lankajs/vue";
 *
 * export const useTodoVM = createLankaVM<ITodoState, ITodoActions>({ … });
 * ```
 *
 * ```vue
 * <script setup lang="ts">
 * const state = useTodoVM();
 * const count = useTodoVM((todos) => todos.rows.length);
 * </script>
 *
 * <template><li v-for="row in state.rows" :key="row">{{ row }}</li></template>
 * ```
 *
 * ```ts
 * useTodoVM.getState().rows; // outside a component, as always
 * ```
 *
 * ## Why the name is core's name
 *
 * It is the same factory and the same config — the whole difference is which
 * package it was imported from, and that difference is what a reader of the
 * import line already sees. A second name would have made every consuming file
 * say twice what one line says once, and a codebase moving off Vue would have
 * had to rewrite its declarations rather than its imports.
 *
 * That is also why this is not an idiom of `@lankajs/vue`: all five bindings
 * publish these six names, so the shelf stays parallel and the guide stays one
 * guide. What differs between members is what the call ANSWERS — here a
 * `ShallowRef`, in React the state itself, in Solid an `Accessor` — which is the
 * same thing that already differs about `useLankaVM`.
 *
 * ## What it does NOT do
 *
 * It is `toLankaCallableVM(createLankaVM(config))` and nothing besides. There is
 * one store, built by core, and the callable is one Proxy over it; a ViewModel
 * declared through this and the same ViewModel declared through
 * `lanka/viewmodel` answer identically, notify identically and dispose
 * identically.
 *
 * ## `defineLankaComposable` is the other spelling, and it stays
 *
 * This answers a ref, because `useLankaVM` answers one. A Pinia codebase reads
 * members straight off what it was handed, and `defineLankaComposable` is that
 * shape — an idiom of this package, over a ViewModel core built. Neither
 * replaces the other: one is the shelf's spelling, one is Vue's.
 *
 * ## No directive, here or on the barrel
 *
 * `"use client"` is React Server Components' mechanism and Vue has none, so a
 * ViewModel declared through this is ordinary code on a Nuxt server. What keeps
 * a server render from leaking a subscription is `useLankaVM`'s `onMounted`
 * seam, and it is there whichever factory declared the ViewModel.
 */
export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaVMConfig<State, Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreLankaVM<State, Actions, TGateways, Services>(config));
}
