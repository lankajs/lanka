import { render } from "@testing-library/svelte";
import { prepareLankaRender } from "@lankajs/tool-testing";
import type { IPrepareLankaRenderOptions } from "@lankajs/tool-testing";
import type { ILankaInstance } from "lanka";

type TSvelteRender = typeof render;

export interface IRenderWithLankaOptions
	extends
		Omit<NonNullable<Parameters<TSvelteRender>[1]>, "wrapper">,
		IPrepareLankaRenderOptions {}

/**
 * What a render answers, plus the instance it used.
 *
 * An intersection rather than an `interface … extends`: Svelte Testing Library's
 * result carries a string index signature for its queries, and a named member
 * added by extension has to satisfy it. An intersection does not ask that.
 */
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
 * Rendering a Svelte tree with a bootstrapped framework.
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
 * Svelte Testing Library's `RenderResult` is generic over the component and its
 * queries, so naming it here would mean guessing three type arguments and
 * re-guessing them whenever the library changes. Reading them off `render`
 * itself cannot drift.
 */
export const renderWithLanka = (
	ui: Parameters<TSvelteRender>[0],
	options: IRenderWithLankaOptions = {},
): ReturnType<TSvelteRender> & IRenderWithLankaResult => {
	const { host, fakes, setup, ...renderOptions } = options;
	const lanka = prepareLankaRender({ host, fakes, setup });

	// One cast, and the reason is the type rather than the value. Svelte Testing
	// Library's result declares a string index signature for its bound queries, so
	// TypeScript asks any NAMED member to satisfy it — and `lanka` is an instance,
	// not a query. The object is exactly what the type says; only the index
	// signature disagrees, and the other four bindings keep the same shape because
	// of it.
	// One cast, and the reason is a defect in the library's own type rather than
	// in this value.
	//
	// Svelte Testing Library's result declares a string index signature saying
	// every member is a QUERY — and then declares `container`, `unmount` and
	// `debug`, none of which is one. So the type already contradicts itself, and
	// adding `lanka` is refused for a rule the library does not keep either.
	//
	// The four other bindings need no cast: their libraries type their results
	// without an index signature, which is why the uniform shape above is an
	// interface over the ADDITION rather than an extension of the whole result.
	return Object.assign(render(ui, renderOptions), {
		lanka,
	}) as unknown as ReturnType<TSvelteRender> & IRenderWithLankaResult;
};
