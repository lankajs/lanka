import { createLazyStatelessLankaVM as createCoreLazyStatelessLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";
import type { TLankaSvelteCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";

/**
 * The config, read off the factory being wrapped rather than named.
 *
 * The other five mirrors in this bucket annotate their parameter with the type
 * core publishes for it. This one cannot: core declares `TLankaStatelessVMConfig`
 * TWICE — once in `createStatelessLankaVM.ts`, which is the one `lanka/viewmodel`
 * publishes, and once inside `createLazyStatelessLankaVM.ts`, which is the one
 * the lazy factory actually takes. The two are not assignable in the direction
 * this file needs, so annotating with the published name would make the mirror
 * REFUSE configs core accepts — a different interface, which is the one thing
 * these six names promise not to be.
 *
 * All three type arguments are always supplied. Core's second and third
 * overloads both take three type parameters, so an instantiation expression
 * given fewer resolves to whichever of them TypeScript reaches last — and that
 * is a `Services` landing in the gateways slot. Full arguments resolve to the
 * one overload that spells both out.
 *
 * The duplicate name in core is a defect and is worth closing there; until it
 * is, this is the only annotation that keeps the promise.
 */
type TCoreLazyStatelessVMConfig<
	Actions extends object,
	TGateways extends object,
	Services extends object,
> = Parameters<typeof createCoreLazyStatelessLankaVM<Actions, TGateways, Services>>[0];

export function createLazyStatelessLankaVM<Actions extends object>(
	config: TCoreLazyStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLankaSvelteCallableVM<
	ReturnType<
		typeof createCoreLazyStatelessLankaVM<Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createLazyStatelessLankaVM<Actions extends object, Services extends object>(
	config: TCoreLazyStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreLazyStatelessLankaVM<Actions, Record<string, never>, Services>>
>;

export function createLazyStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TCoreLazyStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreLazyStatelessLankaVM<Actions, TGateways, Record<string, never>>>
>;

export function createLazyStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TCoreLazyStatelessVMConfig<Actions, TGateways, Services>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreLazyStatelessLankaVM<Actions, TGateways, Services>>
>;

/**
 * The stateless factory's lazy half, callable — and still lazy, for the reason
 * `createLazyLankaVM` in this bucket gives.
 *
 * Why the name is core's name, and what the wrapper does not do, are on
 * `createLankaVM` in this bucket.
 */
export function createLazyStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TCoreLazyStatelessVMConfig<Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreLazyStatelessLankaVM<Actions, TGateways, Services>(config));
}
