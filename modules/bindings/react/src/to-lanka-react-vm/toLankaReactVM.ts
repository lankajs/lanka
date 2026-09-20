import { createLankaCallableVM } from "lanka/extend";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * A ViewModel that is also a hook — what React called a ViewModel before the
 * port existed, and what it may go on calling one.
 *
 * Both call shapes, because both were there: no argument gives the tracked read,
 * a selector gives what the selector picked and bypasses tracking.
 */
export type TLankaReactVMHook<TState extends object> = {
	(): TState;
	<TSelected>(selector: (state: TState) => TSelected): TSelected;
};

/** The ViewModel it was given, plus the ability to be called like a hook. */
export type TLankaReactVM<TViewModel extends ILankaReadableVM<object>> = TViewModel &
	TLankaReactVMHook<ReturnType<TViewModel["getState"]>>;

/**
 * Gives a ViewModel React's own ergonomics back.
 *
 * ```ts
 * // the ViewModel, framework-free, exactly as Vue and Svelte receive it
 * const todoVM = createLankaVM({ … });
 *
 * // the same object, callable
 * export const useTodoVM = toLankaReactVM(todoVM);
 * ```
 *
 * ```tsx
 * const { todos, load } = useTodoVM();
 * const count = useTodoVM((state) => state.todos.length);
 * const todos = useTodoVM.getState().todos; // outside a component, as always
 * ```
 *
 * ## Why this exists
 *
 * Until 2.0 a ViewModel WAS a React hook: `createLankaVM` returned a callable,
 * and every screen in every application on lanka called it. Making the framework
 * framework-free took the call signature away — correctly, because four of the
 * five bindings have no use for one and core may not know what a hook is.
 *
 * That is a fact about CORE, and it was allowed to become a fact about React,
 * which it never had to be. A React consumer's familiar spelling costs one
 * wrapper in the one package that is allowed to know what a hook is, so here it
 * is: `useTodoVM()` reads, `useTodoVM(selector)` selects, `useTodoVM.getState()`
 * and `useTodoVM.subscribe()` do what they always did.
 *
 * ## When to reach for it, now that the factories exist
 *
 * `@lankajs/react` publishes core's six ViewModel factories under core's own
 * names, each already callable — so a ViewModel declared here needs nothing of
 * this. What is left for it is the ViewModel this package did not declare: one
 * built by a CLASS, one handed over by a library, and one declared with core's
 * factory because a server component must read it and this barrel is
 * `"use client"`.
 *
 * ## What it does NOT do
 *
 * It does not change the ViewModel. There is exactly one store, and the call
 * forwards to `useLankaVM` — the same function the five bindings' conformance
 * suite drives. A ViewModel read through this and the same ViewModel read in Vue
 * answer identically, notify identically and skip identically, because it is the
 * same object either way and this adds no state of its own.
 *
 * It is also not required. `useLankaVM(todoVM)` is the portable spelling, it
 * stays the one the guides teach, and a codebase that has moved to it needs
 * nothing here.
 *
 * ## Laziness survives
 *
 * The forwarding is `createLankaCallableVM` in core — a Proxy rather than copied
 * properties — so a ViewModel that builds on first access still builds on first
 * access: reading `useTodoVM.name` answers from the config and constructs
 * nothing. It is core's because all five bindings now need it; which members
 * belong to the function and what `in` must answer have one answer, and this
 * file is no longer one of five places holding it.
 */
export const toLankaReactVM = <TViewModel extends ILankaReadableVM<object>>(
	viewModel: TViewModel,
): TLankaReactVM<TViewModel> => {
	/**
	 * The call signature, and the whole of it.
	 *
	 * Named `useViewModel` rather than passed as an anonymous argument, and the
	 * name is the only thing keeping a lint rule alive here.
	 * `eslint-plugin-react-hooks` analyses a function whose NAME says it is one;
	 * it does not analyse an anonymous callback handed to another function. This
	 * was an anonymous arrow for exactly one review, and a branch put into it —
	 * the mistake this docblock is about — linted clean.
	 *
	 * This IS a custom hook: it calls one, and it may only be called during a
	 * render. ONE call, with the selector forwarded as it arrived, because there
	 * is a `useLankaVM` overload for exactly this. Written as a branch first, and
	 * the lint rule was right to refuse it — a hook inside a ternary is a hook
	 * React cannot promise to call in the same order, and the fact that both arms
	 * happened to call the same one is not something a reader or a rule can see.
	 *
	 * Whether a selector was passed is a property of the CALL SITE and never
	 * changes between renders, which is what `useLankaVM` relies on to keep one
	 * subscription standing across a component's life.
	 */
	const useViewModel = (selector?: (state: object) => unknown): unknown =>
		useLankaVM(viewModel, selector);

	return createLankaCallableVM<TViewModel, TLankaReactVMHook<ReturnType<TViewModel["getState"]>>>(
		viewModel,
		useViewModel,
	);
};
