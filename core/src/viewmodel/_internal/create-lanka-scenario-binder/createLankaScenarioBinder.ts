/**
 * A subscription option bag, as wide as the bus accepts.
 *
 * The binder passes it through and reads only `usedBy`; naming the rest here
 * would make this file a second declaration of the bus's options.
 */
export type TLankaScenarioBindingOptions = Record<string, unknown> & { usedBy?: string };

/**
 * What the binder needs of a binding, and nothing more.
 *
 * Structural rather than the concrete `ILankaScenarioBinding`: three ViewModel
 * families declare their own binding type over their own context, and the binder
 * only ever calls `subscribe` and `handler`.
 */
export interface ILankaScenarioBindingLike<TContext, TData = unknown> {
	scenario: {
		eventType: string;
		subscribe: (
			callback: (data?: TData) => void,
			options?: TLankaScenarioBindingOptions,
		) => () => void;
	};
	handler: (context: TContext) => (data?: TData) => void;
	options?: TLankaScenarioBindingOptions;
}

export interface ILankaScenarioBinderConfig<TContext> {
	/** The ViewModel's name, reported to the bus as the subscriber. */
	name: string;
	/** What to bind. A ViewModel with none still gets a working binder. */
	bindings?: readonly ILankaScenarioBindingLike<TContext>[];
	/** The context handlers are built with, read at bind time. */
	context: () => TContext;
	onInit?: (context: TContext) => void;
	onReset?: (context: TContext) => void;
}

export interface ILankaScenarioBinder {
	/** Whether the bindings are live. */
	readonly isInitialized: boolean;
	/** Subscribes every binding once. A second call does nothing. */
	initializeScenario: () => void;
	/** Releases every subscription and allows a later re-initialisation. */
	resetScenario: () => void;
}

/**
 * The scenario lifetime of a ViewModel: bind once, release on reset.
 *
 * All three ViewModel families need exactly this, and all three had written it
 * out — two with an array plus a Set of seen event types, one with a Map. The
 * Map is the shape kept, because it does both jobs with one structure: the key
 * prevents a second subscription to the same event, and the value is the
 * function that releases THIS subscription.
 *
 * Releasing by callback identity, which an array invites, removes the first
 * entry carrying that callback rather than the caller's own — two handlers whose
 * closures compare equal cancel each other.
 */
export const createLankaScenarioBinder = <TContext>(
	config: ILankaScenarioBinderConfig<TContext>,
): ILankaScenarioBinder => {
	const subscriptions = new Map<string, () => void>();
	let isInitialized = false;

	return {
		get isInitialized(): boolean {
			return isInitialized;
		},

		initializeScenario(): void {
			if (isInitialized) return;

			const context = config.context();

			for (const binding of config.bindings ?? []) {
				const key = binding.scenario.eventType;
				if (subscriptions.has(key)) continue;

				subscriptions.set(
					key,
					binding.scenario.subscribe(binding.handler(context), {
						usedBy: config.name,
						...binding.options,
					}),
				);
			}

			config.onInit?.(context);
			isInitialized = true;
		},

		resetScenario(): void {
			for (const release of subscriptions.values()) release();
			subscriptions.clear();
			isInitialized = false;

			config.onReset?.(config.context());
		},
	};
};
