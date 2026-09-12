import { StoreApi, UseBoundStore } from "zustand";
import { ALankaVM } from "../../_abstractions/lanka-vm/ALankaVM";
import { resolveLankaDependency } from "../../_utils/resolve-lanka-dependency/resolveLankaDependency";
import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import type { ILankaVMConfig } from "../../_interfaces/ILankaVMConfig";

/**
 * The functional style of `ALankaVM`: a ViewModel declared as an options object.
 *
 * Everything it can do, the class can do, because this IS the class — the hooks a
 * subclass overrides arrive here as config fields of the same names, and the
 * protected surface arrives as the `ctx` every hook is handed. What a ViewModel is
 * and how it binds scenarios is documented once, on `ALankaVM`.
 *
 * ⚠️ ACCESS-TRACKING BLIND SPOT. A consumer re-renders only for state keys it READ
 * off the returned proxy. An action that DERIVES a value (`getSomeView()`) reads the
 * store through `get()`, which the proxy never sees — so a component whose only link
 * to a state key is such a getter will never re-render when that key changes.
 *
 * Set `enableAccessTrackingOptimization: false` on such a ViewModel. Do NOT patch it
 * in the view by destructuring the underlying keys for their side effect only: that
 * reads as dead code, so a refactor, an unused-variable cleanup or a lint autofix
 * removes it and the screen silently freezes again. `MeetingReportViewModel` carries
 * the worked example (its report toggles froze exactly that way, twice).
 *
 * In development the mismatch ANNOUNCES ITSELF: the framework sees that a key
 * changed, that no re-render will follow, and that the component reads that key
 * through a getter — and warns with the ViewModel and key names. "Remember to
 * set the flag" is not a mechanism.
 */
export function createLankaVM<State extends object, Actions extends object>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Record<string, never>>,
): UseBoundStore<StoreApi<State & Actions & ILankaScenarioVM>>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, Record<string, never>, Services>,
): UseBoundStore<StoreApi<State & Actions & ILankaScenarioVM>>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Record<string, never>>,
): UseBoundStore<StoreApi<State & Actions & ILankaScenarioVM>>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): UseBoundStore<StoreApi<State & Actions & ILankaScenarioVM>>;

export function createLankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(
	config: ILankaVMConfig<State, Actions, TGateways, Services>,
): UseBoundStore<StoreApi<State & Actions & ILankaScenarioVM>> {
	/**
	 * The bridge subclass lives here rather than in a shared helper because
	 * `toStyleContext` is `protected`: only a class body deriving from `ALankaVM`
	 * may read it. Canon: `skills/parity/SKILL.md` section 3a.
	 */
	class FunctionalVM extends ALankaVM<State, Actions, TGateways, Services> {
		protected readonly name = config.name;

		protected override readonly enableAccessTrackingOptimization =
			config.enableAccessTrackingOptimization ?? true;

		protected override states(): State {
			return config.states ?? ({} as State);
		}

		protected override scenarioHandlers(): NonNullable<typeof config.scenarioHandlers> {
			return config.scenarioHandlers ?? [];
		}

		protected override enhancers(): NonNullable<typeof config.enhancers> {
			return config.enhancers ?? [];
		}

		protected override createGateways(): TGateways {
			return resolveLankaDependency(config.gateways);
		}

		protected override createServices(): Services {
			return resolveLankaDependency(config.services);
		}

		protected createActions(): Actions {
			return config.createActions(this.toStyleContext());
		}

		// The config's hooks become this instance's OWN `onInit`/`onReset`, assigned
		// only when declared. An unconditional method override would make the base
		// read every functional ViewModel as taking both hooks and register it with
		// bootstrap for nothing; an own property is seen by the same test a class
		// override is, and `this.onInit()` means the same thing in both styles.
		public constructor() {
			super();
			const { onInit, onReset } = config;

			if (onInit) this.onInit = () => onInit(this.toStyleContext());
			if (onReset) this.onReset = () => onReset(this.toStyleContext());
		}
	}

	return new FunctionalVM().build();
}
