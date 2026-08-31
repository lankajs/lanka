import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { createStatelessLankaVM } from "../create-stateless-lanka-vm/createStatelessLankaVM";
import type { ILankaVMConfig } from "../../_interfaces/ILankaVMConfig";
import { createLazyLankaHook } from "../../_internal/create-lazy-lanka-hook/createLazyLankaHook";

export type TLankaStatelessVMConfig<
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
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLazyStatelessReturn<Actions, Record<string, never>, Record<string, never>>;

export function createLazyStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLazyStatelessReturn<Actions, Record<string, never>, Services>;

export function createLazyStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLazyStatelessReturn<Actions, TGateways, Record<string, never>>;

export function createLazyStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Services>,
): TLazyStatelessReturn<Actions, TGateways, Services>;

/**
 * The lazy `createStatelessLankaVM`: nothing is built until a screen asks.
 *
 * The mechanism is `createLazyLankaHook` — build on first access, hand every
 * member through, release on `dispose` — and this file is the one line that says
 * WHICH ViewModel is built. It used to be a copy of that mechanism, and the copy
 * had forgotten `setState`, `subscribe` and `getInitialState`: typed as the whole
 * store, absent at runtime.
 */
export function createLazyStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TLankaStatelessVMConfig<Actions, TGateways, Services>) {
	return createLazyLankaHook({
		name: config.name,
		kind: "slVM",
		create: () => createStatelessLankaVM(config),
	});
}
