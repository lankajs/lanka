import { cleanup, render, screen } from "@testing-library/vue";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import AtlasBoardIslandVue from "./AtlasBoardIslandVue.vue";
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

describe("AtlasBoardIslandVue", () => {
	it("starts from what the page already fetched", () => {
		// An island is a client component: it needs nothing from `@lankajs/host`
		// except the one call that makes server data a screen's first state.
		render(AtlasBoardIslandVue, { props: { missions: FROM_THE_PAGE } });

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined();
	});

	it("is interactive, which is the whole reason it is an island", async () => {
		render(AtlasBoardIslandVue, { props: { missions: FROM_THE_PAGE } });
		const input = screen.getByLabelText<HTMLInputElement>("Search Vue missions");

		input.value = "depot";
		// `bubbles` is not decoration: Solid and Svelte 5 both DELEGATE events to the
		// document root, so a non-bubbling event reaches no handler at all — and the
		// screen then looks exactly like a binding that failed to notify.
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await nextTick();

		expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(screen.getByText("AT-102 Restock the depot")).toBeDefined();
	});

	it("hydrates once, so a second render cannot replace what a person is looking at", async () => {
		render(AtlasBoardIslandVue, { props: { missions: FROM_THE_PAGE } });
		cleanup();

		render(AtlasBoardIslandVue, { props: { missions: [mission("m-9", "Something else")] } });
		await nextTick();

		expect(screen.queryByText("AT-109 Something else")).toBeNull();
	});
});
