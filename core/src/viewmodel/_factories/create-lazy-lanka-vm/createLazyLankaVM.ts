import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { createLazyLankaHook } from "../../_internal/create-lazy-lanka-hook/createLazyLankaHook";
import { createLankaVM } from "../create-lanka-vm/createLankaVM";
import type { ILankaVMConfig } from "../../_interfaces/ILankaVMConfig";

export function createLazyLankaVM<State extends object, Actions extends object>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Record<string, never>>,
): TLazyLankaVM<
	ReturnType<typeof createLankaVM<State, Actions, Record<string, never>, Record<string, never>>>,
	State & Actions & ILankaScenarioVM
>;

export function createLazyLankaVM<
	State extends object,
	Actions extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Services>,
): TLazyLankaVM<
	ReturnType<typeof createLankaVM<State, Actions, Record<string, never>, Services>>,
	State & Actions & ILankaScenarioVM
>;

export function createLazyLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Record<string, never>>,
): TLazyLankaVM<
	ReturnType<typeof createLankaVM<State, Actions, TGateways, Record<string, never>>>,
	State & Actions & ILankaScenarioVM
>;

export function createLazyLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): TLazyLankaVM<
	ReturnType<typeof createLankaVM<State, Actions, TGateways, Services>>,
	State & Actions & ILankaScenarioVM
>;

/**
 * The lazy `createLankaVM`: nothing is built until a screen asks.
 *
 * For a ViewModel a session may never open — a settings screen, an admin panel,
 * a route behind a flag. The eager factory builds its store at module load, and
 * this one waits, which is the difference between paying for every screen the
 * application has and paying for the screens it shows.
 *
 * The mechanism is `createLazyLankaHook`, shared with the stateless and
 * shared-store variants, so all three hand through every member the store has
 * and release the same way. This file is the one line that says what gets built.
 */
export function createLazyLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaVMConfig<State, Actions, TGateways, Services>) {
	return createLazyLankaHook({
		name: config.name,
		kind: "VM",
		create: () => createLankaVM(config),
	});
}

/**
 * A lazy ViewModel hook: everything an ordinary store does, plus `dispose`.
 */
export type TLazyLankaVM<TStore, TFullState> = TStore & {
	getState: () => TFullState;
	dispose: () => void;
};
