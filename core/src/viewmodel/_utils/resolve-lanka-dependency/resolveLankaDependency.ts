/**
 * A dependency bag given either directly or as a factory.
 *
 * The factory form exists so a ViewModel declared at module level does not
 * resolve its gateways at import time: the locator needs an active framework
 * instance, and a module body runs before one exists.
 */
export type TLankaDependencyBag<TBag extends object> = TBag | (() => TBag) | undefined;

/**
 * Reads a dependency bag, whichever form it was declared in.
 *
 * All three ViewModel factories wrote this out twice each — once for gateways,
 * once for services — which is six copies of one three-line decision.
 */
export const resolveLankaDependency = <TBag extends object>(
	declared: TLankaDependencyBag<TBag>,
): TBag => {
	if (typeof declared === "function") return declared();
	return declared ?? ({} as TBag);
};
