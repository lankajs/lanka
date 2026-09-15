import { lankaScenarioBootstrap } from "lanka/scenario";
import { lankaTestHost } from "../lankaTestHost";
import { resetLanka } from "../resetLanka";
import { registerLankaFakes } from "../register-lanka-fakes/registerLankaFakes";
import type { ILankaFakes } from "../register-lanka-fakes/registerLankaFakes";
import type { ILankaHost } from "lanka/config";
import type { ILankaInstance } from "lanka";

/** What every binding's `renderWithLanka` takes beyond its own render options. */
export interface IPrepareLankaRenderOptions {
	/** The application host. The test host by default. */
	host?: ILankaHost;
	/**
	 * The doubles the screen should find where it looks for the real thing.
	 *
	 * Registered BEFORE `setup` runs, so a test may use both: the map is the
	 * common case, and the callback is for what a map cannot say.
	 */
	fakes?: ILankaFakes;
	/** What to do with the instance before rendering: install plugins, register scenarios. */
	setup?: (lanka: ILankaInstance) => void;
}

/**
 * A live framework, ready for a render — whichever framework is about to do it.
 *
 * ## Why this is in the kit and not in each binding
 *
 * Four bindings publish `renderWithLanka`, and the four differed only in which
 * `render` they called. Everything else — a fresh instance, the doubles, the
 * caller's setup, and the scenario layer brought up in that order — was the same
 * four times, which is four places for the order to drift.
 *
 * It lives here rather than in one binding because a member of a shelf may not
 * depend on a sibling: the kit is the one thing all four already look at.
 *
 * ## A FRESH instance per call
 *
 * Not reused even within one file. A test that inherits foreign subscriptions
 * passes or fails depending on its neighbour — the worst kind of unreliable
 * test, because it goes red where nothing is broken.
 *
 * ## The scenario layer comes up AFTER `setup` and before the render
 *
 * Without it the instance is live and the scenario layer is not, so a screen
 * whose ViewModel declares `scenarioHandlers` renders with none of them bound —
 * and a test asserting "the fact reaches the screen" fails with nothing naming
 * the reason.
 *
 * Synchronous, unlike `lanka.bootstrap()`, which is the only reason it can
 * happen here at all: a render call cannot await. Bootstrapping with nothing
 * registered binds nothing, so it costs a call for a test that does not need it.
 *
 * It also decides an ORDER a test has to keep. A ViewModel registers itself when
 * it is BUILT, and the `resetLanka` here cleared whatever was registered before
 * — so a ViewModel built at module level, or built before this call, is not
 * bound by it. Build it inside `setup`.
 */
export const prepareLankaRender = (options: IPrepareLankaRenderOptions = {}): ILankaInstance => {
	const lanka = resetLanka(options.host ?? lankaTestHost);

	if (options.fakes) registerLankaFakes(lanka, options.fakes);
	options.setup?.(lanka);

	lankaScenarioBootstrap.bootstrap();

	return lanka;
};
