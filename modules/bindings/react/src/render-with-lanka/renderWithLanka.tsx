import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { prepareLankaRender } from "@lankajs/tool-testing";
import type { ReactElement } from "react";
import type { IPrepareLankaRenderOptions } from "@lankajs/tool-testing";
import type { ILankaInstance } from "lanka";

export interface IRenderWithLankaOptions
	extends Omit<RenderOptions, "wrapper">, IPrepareLankaRenderOptions {}

/**
 * What a render with a bootstrapped framework ADDS to the library's own result.
 *
 * An interface over the addition rather than over the whole result, and the same
 * in all five bindings: Svelte Testing Library's result carries a string index
 * signature for its bound queries, so a named member added by extension has to
 * satisfy it — and `lanka` is an instance, not a query. Describing only the
 * addition is true of every library and needs no cast anywhere.
 */
export interface IRenderWithLankaResult {
	/** The instance the render used. */
	lanka: ILankaInstance;
}

/**
 * Rendering a React tree with a bootstrapped framework.
 *
 * ## Why
 *
 * A component reading a ViewModel needs a live instance: without one the first
 * scenario or locator access fails. Assembling bootstrap in every component test
 * is twenty lines of preamble that diverge between files silently — one test
 * creates an instance, another relies on the previous one, and file order starts
 * deciding the outcome.
 *
 * ## What is here, and what is in the kit
 *
 * The four bindings publish this name and differ only in which `render` they
 * call. Everything else — a fresh instance, the doubles, the caller's setup, and
 * the scenario layer brought up in that order — is `prepareLankaRender` in
 * `@lankajs/tool-testing`, which is the one place all four already look. It also
 * carries the reasons: why the instance is fresh, and why the order matters to a
 * ViewModel built at module level.
 */
export const renderWithLanka = (
	ui: ReactElement,
	options: IRenderWithLankaOptions = {},
): RenderResult & IRenderWithLankaResult => {
	const { host, fakes, setup, ...renderOptions } = options;
	const lanka = prepareLankaRender({ host, fakes, setup });

	return { ...render(ui, renderOptions), lanka };
};
