import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";

/**
 * What must keep coming from the FUNCTION rather than from the ViewModel.
 *
 * Everything else a caller reads by name is the ViewModel's — including `name`,
 * which is the ViewModel's name and was the ViewModel's name before any of this
 * existed, because `build()` defines it over the store.
 *
 * Symbols are excluded wholesale, and that is not tidiness. The ViewModel behind
 * this may be a LAZY proxy, which answers an unknown property with a wrapper
 * function; a wrapper handed back for `Symbol.iterator` makes the callable look
 * iterable, and one for `Symbol.toPrimitive` breaks every string coercion of it.
 * Neither is a member of any ViewModel, so neither may be forwarded.
 *
 * What the exclusion does NOT cover, and what a reader should know before
 * trusting this list: `$$typeof` is a STRING key, so over a lazy ViewModel it is
 * answered with one of those wrappers — measured, and it comes back a function.
 * React compares `$$typeof` against a symbol, so a function is not equal to it
 * and nothing treats the callable as an element; Vue's `isRef` compares
 * `__v_isRef` against `true` for the same reason and is likewise safe. The list
 * above cannot be extended to cover this, because an unknown string key is
 * exactly what a ViewModel's own members look like.
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
 * How the callable answers for the ViewModel behind it.
 *
 * Its own function, because the two traps are the whole mechanism and the
 * factory below is then one Proxy and one cast.
 */
const forwardToViewModel = (
	viewModel: ILankaReadableVM<object>,
): ProxyHandler<(...args: never[]) => unknown> => {
	const members = viewModel as unknown as Record<string, unknown>;

	return {
		get: (target, property, receiver): unknown =>
			typeof property === "symbol" || FUNCTION_MEMBERS.has(property)
				? Reflect.get(target, property, receiver)
				: members[property],

		/**
		 * `in` answers for the ViewModel too.
		 *
		 * Without this the callable would report that it has no `getState`, while
		 * reading `getState` hands one back — and `"getState" in useTodoVM` is how a
		 * devtool, a serialiser and a duck-typed helper ask. The ViewModel behind
		 * this may be a lazy proxy with no `has` trap of its own, so the question is
		 * answered by READING the property, which for a lazy ViewModel builds
		 * nothing.
		 *
		 * The price, measured: over an EAGER ViewModel `"whatever" in callable` is
		 * false, and over a LAZY one it is true, because the lazy proxy answers any
		 * unknown key with a wrapper. `in` is therefore a reliable yes and an
		 * unreliable no, and a caller that needs a real answer asks the state.
		 * Narrowing it would mean asking a lazy ViewModel to enumerate itself,
		 * which is the one thing it exists not to do.
		 */
		has: (target, property) =>
			Reflect.has(target, property) ||
			(typeof property === "string" && members[property] !== undefined),
	};
};

/**
 * A ViewModel that is also the call its binding reads it with.
 *
 * ```ts
 * // inside a binding: the framework's own read, pre-applied
 * const useTodoVM = createLankaCallableVM<typeof todoVM, TMyCall>(todoVM, (selector) =>
 * 	useLankaVM(todoVM, selector),
 * );
 * ```
 *
 * ## Why this is in core and not in a binding
 *
 * Five bindings publish core's six ViewModel factories under core's own names,
 * each one already wearing that framework's read — so a consumer moves a
 * declaration by changing the import line. What every one of them needs to do
 * that is the same object: a function that is ALSO the ViewModel, so
 * `useTodoVM()` reads and `useTodoVM.getState()` does what it always did.
 *
 * The forwarding is the part that is easy to get subtly wrong — which members
 * belong to the function, what `in` must answer, what a lazy ViewModel does with
 * a symbol — and five copies of it would be five packages diverging on a
 * question that has one answer. It lives here for the reason
 * `createLankaAccessTracker` does: what a binding sees is then lanka's behaviour
 * rather than that binding author's reading of it.
 *
 * ## What it does NOT do
 *
 * It adds no state and no second store. The Proxy forwards rather than copying,
 * so a LAZY ViewModel still builds on first access: reading `useTodoVM.name`
 * answers from the config and constructs nothing. `TCall` is the binding's own
 * call signature, because what the call answers is the framework's idea of
 * reactivity and the one thing no binding can hide — a plain state in React, a
 * `ShallowRef` in Vue, an `Accessor` in Solid.
 *
 * **`TCall` is an ASSERTION, not a checked parameter.** The function passed as
 * `call` is typed as the single forwarding signature a binding can actually
 * write, and the overloaded shape a caller wants is not assignable from it — so
 * nothing compares the two, and a `TCall` that stops describing what `call`
 * answers compiles. Declare the call type once, use it at both sites, and keep
 * them within sight of each other; every member of `modules/bindings/` does.
 *
 * **Nine names come from the FUNCTION and cannot be forwarded**: `prototype`,
 * `length`, `arguments`, `caller`, `constructor`, `call`, `apply`, `bind` and
 * `toString`, plus every symbol. The return type says the whole ViewModel is
 * readable, and for a ViewModel built from core's factories it is — none of them
 * collides. A ViewModel written by hand with a public `apply`, `bind` or
 * `length` is inside the constraint and would read the function's instead, with
 * no error anywhere. That is the price of the object being both things at once,
 * and the list is short enough to check a ViewModel against.
 */
export const createLankaCallableVM = <
	TViewModel extends ILankaReadableVM<object>,
	TCall extends (...args: never[]) => unknown,
>(
	viewModel: TViewModel,
	call: (...args: never[]) => unknown,
): TViewModel & TCall => new Proxy(call, forwardToViewModel(viewModel)) as TViewModel & TCall;
