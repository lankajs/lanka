import { createLazyStatelessLankaVM as createCoreLazyStatelessLankaVM } from "lanka/viewmodel";
import type { TLankaLazyStatelessVMConfig } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";
import type { TLankaAngularCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";

export function createLazyStatelessLankaVM<Actions extends object>(
	config: TLankaLazyStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLankaAngularCallableVM<
	ReturnType<
		typeof createCoreLazyStatelessLankaVM<Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createLazyStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaLazyStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreLazyStatelessLankaVM<Actions, Record<string, never>, Services>>
>;

export function createLazyStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaLazyStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreLazyStatelessLankaVM<Actions, TGateways, Record<string, never>>>
>;

export function createLazyStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TLankaLazyStatelessVMConfig<Actions, TGateways, Services>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreLazyStatelessLankaVM<Actions, TGateways, Services>>
>;

/**
 * The stateless factory's lazy half, callable — and still lazy, for the reason
 * `createLazyLankaVM` in this bucket gives.
 *
 * Why the name is core's name, why the declaration needs no injection context,
 * and what the wrapper does not do, are on `createLankaVM` in this bucket.
 */
export function createLazyStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TLankaLazyStatelessVMConfig<Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreLazyStatelessLankaVM<Actions, TGateways, Services>(config));
}
