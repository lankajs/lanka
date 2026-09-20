import { createLazyLankaVM as createCoreLazyLankaVM } from "lanka/viewmodel";
import { toLankaReactVM } from "../../to-lanka-react-vm/toLankaReactVM";
import type { ILankaVMConfig } from "lanka/viewmodel";
import type { TLankaReactVM } from "../../to-lanka-react-vm/toLankaReactVM";

export function createLazyLankaVM<State extends object, Actions extends object>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Record<string, never>>,
): TLankaReactVM<
	ReturnType<
		typeof createCoreLazyLankaVM<State, Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createLazyLankaVM<
	State extends object,
	Actions extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Services>,
): TLankaReactVM<
	ReturnType<typeof createCoreLazyLankaVM<State, Actions, Record<string, never>, Services>>
>;

export function createLazyLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Record<string, never>>,
): TLankaReactVM<
	ReturnType<typeof createCoreLazyLankaVM<State, Actions, TGateways, Record<string, never>>>
>;

export function createLazyLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): TLankaReactVM<ReturnType<typeof createCoreLazyLankaVM<State, Actions, TGateways, Services>>>;

/**
 * The lazy factory, callable — and still lazy.
 *
 * `toLankaReactVM` forwards through a Proxy rather than copying members, so a
 * ViewModel that builds on first access still builds on first access: declaring
 * this at module level constructs nothing, and `useTodoVM.name` answers from the
 * config. The store arrives when a screen first reads it.
 *
 * Why the name is core's name, and what the wrapper does not do, are on
 * `createLankaVM` in this bucket.
 */
export function createLazyLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaVMConfig<State, Actions, TGateways, Services>) {
	return toLankaReactVM(createCoreLazyLankaVM<State, Actions, TGateways, Services>(config));
}
