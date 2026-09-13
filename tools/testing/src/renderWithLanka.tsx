import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { lankaScenarioBootstrap } from "lanka/scenario";
import type { ILankaInstance, ILankaHost } from "lanka";
import { lankaTestHost } from "./lankaTestHost";
import { resetLanka } from "./resetLanka";
import { registerLankaFakes } from "./register-lanka-fakes/registerLankaFakes";
import type { ILankaFakes } from "./register-lanka-fakes/registerLankaFakes";

export interface IRenderWithLankaOptions extends Omit<RenderOptions, "wrapper"> {
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

export interface IRenderWithLankaResult extends RenderResult {
	/** The instance the render used. */
	lanka: ILankaInstance;
}

/**
 * Rendering with a bootstrapped framework.
 *
 * ## Why
 *
 * A component reading a ViewModel needs a live instance: without one the first
 * scenario or locator access fails. Assembling bootstrap in every component test
 * is twenty lines of preamble that diverge between files silently — one test
 * creates an instance, another relies on the previous one, and file order starts
 * deciding the outcome.
 *
 * ## A FRESH instance per call
 *
 * Not reused even within one file. A test that inherits foreign subscriptions
 * passes or fails depending on its neighbour — the worst kind of unreliable
 * test, because it goes red where nothing is broken.
 */
export const renderWithLanka = (
	ui: ReactElement,
	options: IRenderWithLankaOptions = {},
): IRenderWithLankaResult => {
	const { host, fakes, setup, ...renderOptions } = options;

	const lanka = resetLanka(host ?? lankaTestHost);
	if (fakes) registerLankaFakes(lanka, fakes);
	setup?.(lanka);

	// The scenario layer, brought up AFTER `setup` and before the render.
	//
	// Without it the first sentence above was untrue: the instance was live and
	// the scenario layer was not, so a screen whose ViewModel declares
	// `scenarioHandlers` rendered with none of them bound — and a test asserting
	// "the fact reaches the screen" failed with nothing naming the reason.
	//
	// Synchronous, unlike `lanka.bootstrap()`, which is the only reason it can
	// happen here at all: `render` cannot await. Bootstrapping with nothing
	// registered binds nothing, so it costs a call for a test that does not need
	// it.
	//
	// It also decides an ORDER a test has to keep. A ViewModel registers itself
	// when it is BUILT, and the `resetLanka` above cleared whatever was
	// registered before — so a ViewModel built at module level, or built before
	// this call, is not bound by this. Build it inside `setup`.
	lankaScenarioBootstrap.bootstrap();

	return { ...render(ui, renderOptions), lanka };
};
