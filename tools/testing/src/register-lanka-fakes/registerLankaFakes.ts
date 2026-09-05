import type { ILankaInstance } from "lanka/bootstrap";

/**
 * The doubles a test puts where the application would find the real thing.
 *
 * Each key is the CLASS NAME the application's barrel publishes — the same name
 * the locator resolves — and the value is whatever stands in for it.
 */
export interface ILankaFakes {
	gateways?: Readonly<Record<string, unknown>>;
	singletons?: Readonly<Record<string, unknown>>;
	sharedStores?: Readonly<Record<string, unknown>>;
	scenarios?: Readonly<Record<string, unknown>>;
}

/**
 * Puts a test's doubles where the framework will look for them.
 *
 * ## Why a kit function rather than four lines in the test
 *
 * `lanka.locators.gateways.registerInstance("TodoGateway", fake)` is the shape
 * every consumer test needs and the one no consumer should have to learn: the
 * locator, its name, and which of the four holds what are mechanism. A test says
 * WHICH double stands for WHICH name, and this is the sentence that says it.
 *
 * ## Why the doubles are not typed against the locators' bases
 *
 * A double is not required to extend `ALankaGateway` — that it does not is the
 * whole reason it is cheap to write. The locators' generics describe what an
 * APPLICATION registers, and holding a test to them would turn every double into
 * a subclass with a constructor to satisfy.
 */
export const registerLankaFakes = (lanka: ILankaInstance, fakes: ILankaFakes): void => {
	const { gateways, singletons, sharedStores, scenarios } = lanka.locators;

	registerInto(gateways, fakes.gateways);
	registerInto(singletons, fakes.singletons);
	registerInto(sharedStores, fakes.sharedStores);
	registerInto(scenarios, fakes.scenarios);
};

/** One locator's worth, so the four calls above read as a list. */
const registerInto = (
	locator: { registerInstance: (name: string, instance: never) => void },
	fakes: Readonly<Record<string, unknown>> | undefined,
): void => {
	if (!fakes) return;

	for (const [name, fake] of Object.entries(fakes)) {
		locator.registerInstance(name, fake as never);
	}
};
