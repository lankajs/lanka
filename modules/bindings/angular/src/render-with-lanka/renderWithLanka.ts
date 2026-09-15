import { render, type RenderComponentOptions, type RenderResult } from "@testing-library/angular";
import { prepareLankaRender } from "@lankajs/tool-testing";
import type { Type } from "@angular/core";
import type { IPrepareLankaRenderOptions } from "@lankajs/tool-testing";
import type { ILankaInstance } from "lanka";

export interface IRenderWithLankaOptions<TComponent>
	extends Omit<RenderComponentOptions<TComponent>, "wrapper">, IPrepareLankaRenderOptions {}

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
 * Rendering an Angular component with a bootstrapped framework.
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
 * ## Angular's is asynchronous, and that is its own
 *
 * Angular Testing Library drives `TestBed`, which COMPILES a component rather
 * than merely mounting one, so `render` answers a promise. The four other
 * bindings answer directly. That difference belongs to Angular's testing story
 * and not to lanka, which is why it is not hidden behind a synchronous wrapper.
 */
export const renderWithLanka = async <TComponent>(
	component: Type<TComponent>,
	options: IRenderWithLankaOptions<TComponent> = {},
): Promise<RenderResult<TComponent, TComponent> & IRenderWithLankaResult> => {
	const { host, fakes, setup, ...renderOptions } = options;
	const lanka = prepareLankaRender({ host, fakes, setup });

	return { ...(await render(component, renderOptions)), lanka };
};
