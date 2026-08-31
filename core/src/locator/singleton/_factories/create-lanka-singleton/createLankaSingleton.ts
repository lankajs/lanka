import { ALankaSingleton } from "../../_abstractions/lanka-singleton/ALankaSingleton";

/**
 * The functional style of `ALankaSingleton`: a singleton declared by a function.
 *
 * A singleton is a role — an application writes many — and this is the same role
 * the class style declares by extending the marker. What comes back IS a subclass
 * of `ALankaSingleton`, so the locator discovers it in the consumer's barrel,
 * builds it on first use and caches it, exactly as it does a hand-written class.
 *
 * ```ts
 * export const PlaygroundClock = createLankaSingleton(() => ({
 * 	now: () => Date.now(),
 * }));
 * ```
 *
 * The result is exported under a PascalCase name because it is a class: the
 * locator resolves `lankaSingletons.playgroundClock` by that export name, and a
 * camelCase one would read as the instance while being the constructor.
 *
 * The builder runs at first resolution, not here — a singleton declared in a
 * module body must not touch a runtime that does not exist yet. Canon:
 * `skills/parity/SKILL.md`.
 */
export const createLankaSingleton = <TInstance extends object>(
	build: () => TInstance,
): new () => TInstance => {
	class FunctionalSingleton extends ALankaSingleton {
		public constructor() {
			super();

			// A constructor answering an object is what makes the two styles one
			// implementation: the locator constructs a marked class either way, and
			// what it gets back is what the builder returned.
			return build();
		}
	}

	return FunctionalSingleton as unknown as new () => TInstance;
};
