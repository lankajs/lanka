import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup as cleanupReact, fireEvent as fireReact } from "@testing-library/react";
import { cleanup as cleanupVue, render as renderVue } from "@testing-library/vue";
import { atlasMissionAssigned } from "@lanka-playgrounds/_shared";
import { createElement } from "react";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { renderWithLanka } from "@lankajs/react/testing";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { screen, waitFor, within } from "@testing-library/dom";
import { AtlasBoardIsland } from "./AtlasBoardIsland";
import AtlasBoardIslandVue from "./AtlasBoardIslandVue.vue";
import { atlasIslandMissionsVM } from "./atlasIslandMissionsVM";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The page, rather than one island on it.
 *
 * Every other suite in this folder renders ONE island and asks whether that
 * framework can read a ViewModel — which each of them could, separately, while
 * the page they share was wrong: three islands built three stores, so typing in
 * the React one left the Vue one beside it showing an unfiltered list, and
 * nothing reported it because nothing had ever rendered two at once.
 *
 * ## No JSX anywhere in this file, and that is not a style choice
 *
 * `jsx`/`jsxImportSource` are per-PROGRAM, and this file imports a React island
 * and a Vue component. `createElement` and `render(Component, …)` are what let
 * one module reach two frameworks; the moment a `<tag>` appears here, the file
 * belongs to one of them. `vitest.config.ts` gives React and Solid an `include`
 * glob each for the same reason.
 *
 * Svelte's island is not here. It builds its ViewModel in the instance script,
 * once per mount, for a reason written in that file — and `atlasIslandMissionsVM`
 * says why that was left alone rather than made symmetrical.
 */
const mission = (id: string, title: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-13T00:00:00.000Z",
	...over,
});

const FROM_THE_PAGE = [
	mission("m-1", "Survey the north ridge"),
	mission("m-2", "Restock the depot"),
];

/**
 * Both islands, the way the page mounts them: React first, then Vue.
 *
 * The store is SEEDED here rather than left to hydration, and the reason is the
 * thing that makes one shared store different from five per-scene ones.
 * `hydrateLankaVM` applies ONCE per ViewModel — that is what stops a second
 * render replacing what a reader is looking at — and a module-level store
 * outlives the scene that filled it. So the first scene to call this would
 * hydrate and every later one would find the call a no-op, which reads as "the
 * scenario never arrived" when what happened is that the page was empty.
 *
 * Both islands still call `hydrateLankaVM` themselves, and that is still the
 * claim: they are handed the same prop, and the second one to mount does not
 * overwrite the first.
 */
const page = () => {
	atlasIslandMissionsVM.setState({ missions: FROM_THE_PAGE, search: "", page: 1 });
	renderWithLanka(createElement(AtlasBoardIsland, { missions: FROM_THE_PAGE }));
	renderVue(AtlasBoardIslandVue, { props: { missions: FROM_THE_PAGE } });

	return {
		react: () => within(screen.getByLabelText("Missions")),
		vue: () => within(screen.getByLabelText("Missions in Vue")),
	};
};

beforeAll(async () => {
	// ONCE for the file, and the reset comes FIRST. `atlasIslandMissionsVM` is
	// built when its module is imported, which is before any runtime exists; what
	// puts a ViewModel like that on the scenario bus is the bootstrap inside
	// `startLanka`, which initialises the ViewModels that already exist.
	//
	// Which is also why there is no reset BETWEEN scenes, unlike every SPA suite
	// here. A module-level store survives `resetActiveLanka()` and its scenario
	// registration does not, so a second reset would leave the islands reading a
	// ViewModel that no longer hears anything — invisible until a scene asks, and
	// this one did.
	resetActiveLanka();
	await startLanka({ host: lankaTestHost });
});

afterAll(() => {
	resetActiveLanka();
});

afterEach(() => {
	cleanupReact();
	cleanupVue();
});

describe("two islands, two frameworks, one page", () => {
	it("reads one ViewModel from two islands at once", async () => {
		// The claim the four one-island suites could not make. Both islands render
		// the same two rows because both read the same store — not because both
		// were handed the same prop, which is what they would do if the page still
		// had three.
		const { react, vue } = page();

		expect(react().getByText("AT-101 Survey the north ridge")).toBeDefined();
		expect(vue().getByText("AT-101 Survey the north ridge")).toBeDefined();

		// Typed into REACT's box, and the assertion is about Vue's list. One
		// framework's event handler called an action, the store moved, and a
		// component compiled by another framework repainted.
		fireReact.change(react().getByLabelText("Search missions"), {
			target: { value: "depot" },
		});

		await waitFor(() =>
			expect(react().queryByText("AT-101 Survey the north ridge")).toBeNull(),
		);
		expect(vue().queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(vue().getByText("AT-102 Restock the depot")).toBeDefined();
	});

	it("carries a scenario released on the page to every island reading it", async () => {
		// A fact, not an action: nothing here touches a ViewModel or either island.
		// `atlasMissionAssigned` is one of the four scenarios the missions
		// ViewModel handles, its handler applies the DATA it was given rather than
		// refetching, and both islands repaint off that one write.
		//
		// TRIGGERED from the page rather than from an island, and that is a
		// deliberate limit rather than the whole claim: no island on this page
		// writes — all four are a search box over a list — so the raising side is
		// what the five SPA suites cover, each with an action of its own. What is
		// only true HERE is the arriving side reaching two frameworks at once.
		const { react, vue } = page();

		atlasMissionAssigned.trigger({
			id: "m-1",
			crewId: "c-1",
			mission: mission("m-1", "Escort the relay convoy", { crewId: "c-1" }),
		});

		await waitFor(() =>
			expect(react().getByText("AT-101 Escort the relay convoy")).toBeDefined(),
		);
		expect(vue().getByText("AT-101 Escort the relay convoy")).toBeDefined();
		expect(react().queryByText("AT-101 Survey the north ridge")).toBeNull();
	});
});
