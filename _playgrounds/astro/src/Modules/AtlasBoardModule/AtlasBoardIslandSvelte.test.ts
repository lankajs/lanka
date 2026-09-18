import { cleanup, render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import AtlasBoardIslandSvelte from "./AtlasBoardIslandSvelte.svelte";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

const mission = (id: string, title: string): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-13T00:00:00.000Z",
});

const FROM_THE_PAGE = [
	mission("m-1", "Survey the north ridge"),
	mission("m-2", "Restock the depot"),
];

afterEach(() => {
	cleanup();
});

describe("AtlasBoardIslandSvelte", () => {
	it("starts from what the page already fetched", () => {
		// An island is a client component: it needs nothing from `@lankajs/host`
		// except the one call that makes server data a screen's first state.
		render(AtlasBoardIslandSvelte, { props: { missions: FROM_THE_PAGE } });

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined();
	});

	it("is interactive, which is the whole reason it is an island", () => {
		render(AtlasBoardIslandSvelte, { props: { missions: FROM_THE_PAGE } });
		const input = screen.getByLabelText<HTMLInputElement>("Search Svelte missions");

		input.value = "depot";
		// `bubbles` is not decoration: Solid and Svelte 5 both DELEGATE events to the
		// document root, so a non-bubbling event reaches no handler at all — and the
		// screen then looks exactly like a binding that failed to notify.
		input.dispatchEvent(new Event("input", { bubbles: true }));
		flushSync();

		expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(screen.getByText("AT-102 Restock the depot")).toBeDefined();
	});

	it("builds its ViewModel per INSTANCE, so a second mount is a second board", () => {
		// The one island on this page whose ViewModel is NOT module level, and the
		// scene says what that buys: hydration applies once per store, so a store
		// per mount is a mount that starts from its own data. The React and Vue
		// islands assert the opposite, and all three are each framework's own rule.
		render(AtlasBoardIslandSvelte, { props: { missions: FROM_THE_PAGE } });
		cleanup();

		render(AtlasBoardIslandSvelte, { props: { missions: [mission("m-9", "Something else")] } });
		flushSync();

		expect(screen.getByText("AT-109 Something else")).toBeDefined();
	});
});
