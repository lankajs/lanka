import { createStatelessLankaVM as createCoreStatelessLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";
import type { TLankaStatelessVMConfig } from "lanka/viewmodel";
import type { TLankaSvelteCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";

export function createStatelessLankaVM<Actions extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLankaSvelteCallableVM<
	ReturnType<
		typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Services>>
>;

export function createStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Record<string, never>>>
>;

export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Services>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Services>>
>;

/**
 * Orchestration with no reactive fields of its own, callable.
 *
 * A stateless ViewModel holds actions, so the call answers a view over the
 * actions — `const { run } = importVM()` — and nothing ever invalidates it,
 * because the port's `subscribe` for this shape returns an unsubscribe and never
 * calls its listener. That is what lets one reader serve all three ViewModel
 * shapes without asking which it was handed.
 *
 * Why the name is core's name, and what the wrapper does not do, are on
 * `createLankaVM` in this bucket.
 */
export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TLankaStatelessVMConfig<Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreStatelessLankaVM<Actions, TGateways, Services>(config));
}
