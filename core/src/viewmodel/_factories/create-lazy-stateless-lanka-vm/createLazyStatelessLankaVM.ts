import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { createStatelessLankaVM } from "../create-stateless-lanka-vm/createStatelessLankaVM";
import type { ILankaVMConfig } from "../../_interfaces/ILankaVMConfig";
import { createLazyLankaVMProxy } from "../../_internal/create-lazy-lanka-vm-proxy/createLazyLankaVMProxy";

/**
 * What the LAZY stateless factory takes, which is not what the eager one takes.
 *
 * This type was called `TLankaStatelessVMConfig` — the same name the eager
 * factory declares and `lanka/viewmodel` publishes — and the two are not the
 * same shape. One name over two types is a surface that cannot be read: a
 * consumer annotating a shared config with the published name and passing it
 * here got a compile error nothing in the published surface explained, and five
 * binding mirrors had to derive their parameter type off this function rather
 * than name it. Renaming costs nothing, because no barrel ever re-exported the
 * duplicate.
 *
 * **Where it genuinely differs, and it is not cosmetic.** The eager config hands
 * `createActions`, `onInit` and `onReset` an `ILankaStatelessVMContext`, whose
 * `set` is `TLankaSetState`. This one is `ILankaVMConfig` with `states` removed,
 * so it hands them the STATEFUL `ILankaVMContext`, whose `set` is zustand's
 * `setState` — including the `replace` argument, on a ViewModel that holds
 * nothing to replace.
 *
 * It also accepts `enhancers` and `enableAccessTrackingOptimization`, which
 * `createStatelessLankaVM` does not read: a stateless ViewModel has no store to
 * enhance and nothing whose reads could be tracked. They are accepted and
 * ignored, and that is worth knowing before writing one.
 *
 * Both are the eager factory's shape leaking through `Omit`, and narrowing this
 * to the eager config would REFUSE configs that compile today — the unsafe move
 * `skills/surface/SKILL.md` §6c names. So the difference is published under its
 * own name instead, where a reader meets it, and closing it belongs to a major.
 */
export type TLankaLazyStatelessVMConfig<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
> = Omit<ILankaVMConfig<object, Actions, TGateways, Services>, "states"> & {
	states?: never;
};

type TLazyStatelessReturn<
	Actions extends object,
	TGateways extends object,
	Services extends object,
> = ReturnType<typeof createStatelessLankaVM<Actions, TGateways, Services>> & {
	getState: () => Actions & ILankaScenarioVM;
	dispose: () => void;
};

export function createLazyStatelessLankaVM<Actions extends object>(
	config: TLankaLazyStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLazyStatelessReturn<Actions, Record<string, never>, Record<string, never>>;

export function createLazyStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaLazyStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLazyStatelessReturn<Actions, Record<string, never>, Services>;

export function createLazyStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaLazyStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLazyStatelessReturn<Actions, TGateways, Record<string, never>>;

export function createLazyStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TLankaLazyStatelessVMConfig<Actions, TGateways, Services>,
): TLazyStatelessReturn<Actions, TGateways, Services>;

/**
 * The lazy `createStatelessLankaVM`: nothing is built until a screen asks.
 *
 * The mechanism is `createLazyLankaVMProxy` — build on first access, hand every
 * member through, release on `dispose` — and this file is the one line that says
 * WHICH ViewModel is built. It used to be a copy of that mechanism, and the copy
 * had forgotten `setState`, `subscribe` and `getInitialState`: typed as the whole
 * store, absent at runtime.
 */
export function createLazyStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TLankaLazyStatelessVMConfig<Actions, TGateways, Services>) {
	return createLazyLankaVMProxy({
		name: config.name,
		kind: "slVM",
		// A stateless ViewModel has no reactive fields, so there is nothing whose
		// reads could be worth recording — the eager one answers false too.
		isAccessTracked: false,
		create: () => createStatelessLankaVM(config),
	});
}
