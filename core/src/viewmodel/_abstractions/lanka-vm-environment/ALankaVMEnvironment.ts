import type { ILankaVMLifecycleHooks } from "../../_interfaces/ILankaVMLifecycleHooks";

/**
 * What every ViewModel is given, and the two moments it is told about.
 *
 * The three ViewModel shapes — stateful, stateless, over a shared store — differ
 * in where their state lives and in nothing else about this: each is handed a
 * data layer and a set of collaborators, and each is told when its scenarios are
 * bound and when they are about to be unbound.
 *
 * Stated once because a fifth hook added to two of the three is exactly the
 * divergence `skills/parity/SKILL.md` is written against, and three copies of a
 * default is how that starts.
 *
 * It is not a role and nothing extends it directly: the three bases do, and a
 * consumer extends one of them.
 */
export abstract class ALankaVMEnvironment<
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
> {
	/** What `createGateways` answered: the data layer, kept apart from services. */
	protected gateways!: TGateways;

	/** What `createServices` answered: everything that is not a gateway. */
	protected services!: Services;

	/** The data layer, built once per ViewModel. */
	protected createGateways(): TGateways {
		return {} as TGateways;
	}

	/** Non-gateway collaborators, built once per ViewModel. */
	protected createServices(): Services {
		return {} as Services;
	}

	/**
	 * Runs once the scenarios are bound: inside `startLanka()` for a ViewModel built
	 * at module level, inside `build()` for one built after bootstrap — in both
	 * cases before any screen has read the hook the build returns.
	 */
	protected onInit(): void {}

	/**
	 * Runs when the ViewModel is released — the framework instance disposed, or a
	 * lazy ViewModel's `dispose()` — after its scenario subscriptions are gone.
	 */
	protected onReset(): void {}

	/**
	 * The two moments above as the scenario binder receives them: present only
	 * where this ViewModel took them.
	 *
	 * Framework plumbing, not an extension point — a ViewModel overrides `onInit`
	 * and `onReset`, never this. Protected because the three bases call it, and
	 * named after `toStyleContext` for the same reason: a derived view of the
	 * protected surface, assembled by the framework.
	 *
	 * Why "took them" decides anything: `onInit` runs inside `initializeScenario`,
	 * which bootstrap alone calls, on the ViewModels registered with it.
	 * Registration used to follow scenario bindings only, so a ViewModel that
	 * overrode `onInit` and bound nothing was never initialised — silently. Now a
	 * declared hook registers the ViewModel too, and a default no-op must not
	 * count, or every ViewModel would sit in the scenario registry for nothing.
	 * The functional bridges declare theirs as own properties over these methods,
	 * which is what this comparison sees.
	 */
	protected toLifecycleHooks(): ILankaVMLifecycleHooks {
		const defaults = ALankaVMEnvironment.prototype;
		const hooks: ILankaVMLifecycleHooks = {};

		if (this.onInit !== defaults.onInit) hooks.onInit = () => this.onInit();
		if (this.onReset !== defaults.onReset) hooks.onReset = () => this.onReset();

		return hooks;
	}
}
