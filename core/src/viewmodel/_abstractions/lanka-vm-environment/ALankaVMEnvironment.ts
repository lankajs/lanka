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

	/** Runs after the scenarios are bound. */
	protected onInit(): void {}

	/** Runs when the screen goes away, before the scenarios are unbound. */
	protected onReset(): void {}
}
