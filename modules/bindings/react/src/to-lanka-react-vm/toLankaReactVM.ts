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
 * What must keep coming from the FUNCTION rather than from the ViewModel.
 *
 * Everything else a caller reads by name is the ViewModel's — including `name`,
 * which is the ViewModel's name and was the ViewModel's name before this
 * function existed, because `build()` defines it over the store.
 *
 * Symbols are excluded wholesale, and that is not tidiness. The ViewModel behind
 * this may be a LAZY proxy, which answers an unknown property with a wrapper
 * function; a wrapper handed back for `Symbol.iterator` makes the hook look
 * iterable, one for `Symbol.toPrimitive` breaks every string coercion of it, and
 * one for `$$typeof` makes React look at it as an element. None of those is a
 * member of any ViewModel, so none of them may be forwarded.
 */
const FUNCTION_MEMBERS: ReadonlySet<string> = new Set([
	"prototype",
	"length",
	"arguments",
	"caller",
	"constructor",
	"call",
	"apply",
	"bind",
	"toString",
]);

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
 * The forwarding is a Proxy rather than copied properties, so a ViewModel that
 * builds on first access still builds on first access: reading `useTodoVM.name`
 * answers from the config and constructs nothing.
 */
export const toLankaReactVM = <TViewModel extends ILankaReadableVM<object>>(
	viewModel: TViewModel,
): TLankaReactVM<TViewModel> => {
	/**
	 * The call signature, and the whole of it.
	 *
	 * Named `useViewModel` rather than `hook`: this IS a custom hook — it calls
	 * one, it may only be called during a render, and a name not starting with
	 * `use` hid both facts from every reader and from React's lint rule.
	 *
	 * ONE call, with the selector forwarded as it arrived — there is a
	 * `useLankaVM` overload for exactly this. Written as a branch first, and the
	 * lint rule was right to refuse it: a hook inside a ternary is a hook React
	 * cannot promise to call in the same order, and the fact that both arms
	 * happened to call the same one is not something a reader or a rule can see.
	 *
	 * Whether a selector was passed is a property of the CALL SITE and never
	 * changes between renders, which is what `useLankaVM` relies on to keep one
	 * subscription standing across a component's life.
	 */
	const useViewModel = (selector?: (state: object) => unknown): unknown =>
		useLankaVM(viewModel, selector);

	return new Proxy(useViewModel, {
		get: (target, property, receiver): unknown =>
			typeof property === "symbol" || FUNCTION_MEMBERS.has(property)
				? Reflect.get(target, property, receiver)
				: (viewModel as unknown as Record<string, unknown>)[property],

		/**
		 * `in` answers for the ViewModel too.
		 *
		 * Without this the hook would report that it has no `getState`, while
		 * reading `getState` hands one back — and `"getState" in useTodoVM` is how
		 * a devtool, a serialiser and a duck-typed helper ask. The ViewModel behind
		 * this may be a lazy proxy with no `has` trap of its own, so the question
		 * is answered by READING the property, which for a lazy ViewModel builds
		 * nothing.
		 */
		has: (target, property) =>
			Reflect.has(target, property) ||
			(typeof property === "string" &&
				(viewModel as unknown as Record<string, unknown>)[property] !== undefined),
	}) as TLankaReactVM<TViewModel>;
};
