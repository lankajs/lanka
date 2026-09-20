import { toLankaReactVM } from "../to-lanka-react-vm/toLankaReactVM";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { TLankaReactVM } from "../to-lanka-react-vm/toLankaReactVM";

/**
 * Gives any ViewModel this binding's read, already applied — the shelf's name
 * for what `toLankaReactVM` has always done here.
 *
 * ```ts
 * // a ViewModel this package did not declare: a class, a library's, one core built
 * export const useRunVM = toLankaCallableVM(new RunVM().build());
 * ```
 *
 * ## Why a second name for one function
 *
 * The six factories answer a callable for a ViewModel DECLARED through them, and
 * that left the class style a step behind: `createLankaVM(config)` is one line
 * and `new RunVM().build()` still needed wrapping by hand. Every member had the
 * wrapper — it is what the six are built on — and four of them kept it private,
 * so four frameworks had no published way to say it.
 *
 * It is published under ONE name in all five, which is what makes it parity
 * rather than an idiom: the same sentence in every guide, and a screen that
 * moves between frameworks rewrites its view and not its vocabulary. What
 * differs is what the call ANSWERS, exactly as it already does for `useLankaVM`.
 *
 * `toLankaReactVM` is the older spelling of this and is not going anywhere — a
 * published name is never removed, hundreds of call sites type it, and it says
 * "React" to a reader who wants that. New code may write either; this one is the
 * one the other four bindings also answer to.
 */
export const toLankaCallableVM = <TViewModel extends ILankaReadableVM<object>>(
	viewModel: TViewModel,
): TLankaReactVM<TViewModel> => toLankaReactVM(viewModel);
