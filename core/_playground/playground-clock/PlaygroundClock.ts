import { createLankaSingleton } from "../../src/locator/index";

/** What the clock answers, named so a screen can depend on the shape. */
export interface IPlaygroundClock {
	readonly startedAt: number;
	ticks: () => number;
}

/**
 * A second singleton, declared by calling rather than by extending.
 *
 * Beside `PlaygroundSessionService` on purpose: the locator registers, builds and
 * caches both through the same path and cannot tell which style wrote them. What
 * it is given is a class either way — this one just was not typed out.
 */
export const PlaygroundClock = createLankaSingleton<IPlaygroundClock>(() => {
	const startedAt = 0;
	let seen = 0;

	return {
		startedAt,
		ticks: () => {
			seen += 1;
			return seen;
		},
	};
});
