import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import type { ILankaInstance, ILankaHost } from "lanka";
import { lankaTestHost } from "./lankaTestHost";
import { resetLanka } from "./resetLanka";

export interface IRenderWithLankaOptions extends Omit<RenderOptions, "wrapper"> {
	/** The application host. The test host by default. */
	host?: ILankaHost;
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
	const { host, setup, ...renderOptions } = options;

	const lanka = resetLanka(host ?? lankaTestHost);
	setup?.(lanka);

	return { ...render(ui, renderOptions), lanka };
};
