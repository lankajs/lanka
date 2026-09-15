import { render } from "@solidjs/testing-library";
import { prepareLankaRender } from "@lankajs/tool-testing";
import type { IPrepareLankaRenderOptions } from "@lankajs/tool-testing";
import type { ILankaInstance } from "lanka";

type TSolidRender = typeof render;

export interface IRenderWithLankaOptions
	extends Omit<NonNullable<Parameters<TSolidRender>[1]>, "wrapper">, IPrepareLankaRenderOptions {}

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
 * Rendering a Solid tree with a bootstrapped framework.
 *
 * ## Why
 *
 * A component reading a ViewModel needs a live instance: without one the first
 * scenario or locator access fails. Assembling bootstrap in every component test
 * is twenty lines of preamble that diverge between files silently.
 *
 * ## What is here, and what is in the kit
 *
 * The five bindings publish this name and differ only in which `render` they
 * call. Everything else — a fresh instance, the doubles, the caller's setup and
 * the scenario layer brought up in that order — is `prepareLankaRender` in
 * `@lankajs/tool-testing`, which is the one place all five already look.
 *
 * ## The option and result types are DERIVED, not named
 *
 * Solid Testing Library publishes no `RenderOptions` or `RenderResult` type to
 * import — it exports functions and lets inference do the rest. Reading them off
 * `render` itself is therefore the honest spelling, and it cannot drift from the
 * library the way a hand-copied interface would.
 */
export const renderWithLanka = (
	ui: Parameters<TSolidRender>[0],
	options: IRenderWithLankaOptions = {},
): ReturnType<TSolidRender> & IRenderWithLankaResult => {
	const { host, fakes, setup, ...renderOptions } = options;
	const lanka = prepareLankaRender({ host, fakes, setup });

	return { ...render(ui, renderOptions), lanka };
};
