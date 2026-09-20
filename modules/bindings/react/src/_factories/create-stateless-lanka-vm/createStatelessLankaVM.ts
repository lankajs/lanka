import { createStatelessLankaVM as createCoreStatelessLankaVM } from "lanka/viewmodel";
import { toLankaReactVM } from "../../to-lanka-react-vm/toLankaReactVM";
import type { TLankaStatelessVMConfig } from "lanka/viewmodel";
import type { TLankaReactVM } from "../../to-lanka-react-vm/toLankaReactVM";

export function createStatelessLankaVM<Actions extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLankaReactVM<
	ReturnType<
		typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLankaReactVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Services>>
>;

export function createStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLankaReactVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Record<string, never>>>
>;

export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Services>,
): TLankaReactVM<ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Services>>>;

/**
 * Orchestration with no reactive fields of its own, callable.
 *
 * A stateless ViewModel holds actions, so the call answers the actions — which
 * is what it answered when a ViewModel WAS a hook, and why the 1.x spelling
 * `const { run } = useImportVM()` keeps working.
 *
 * Why the name is core's name, and what the wrapper does not do, are on
 * `createLankaVM` in this bucket.
 */
export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TLankaStatelessVMConfig<Actions, TGateways, Services>) {
	return toLankaReactVM(createCoreStatelessLankaVM<Actions, TGateways, Services>(config));
}
