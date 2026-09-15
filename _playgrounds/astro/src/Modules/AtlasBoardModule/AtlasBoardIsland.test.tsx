import { renderWithLanka } from "@lankajs/react/testing";
import { screen } from "@testing-library/dom";
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AtlasBoardIsland } from "./AtlasBoardIsland";
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

describe("AtlasBoardIsland", () => {
	it("starts from what the page already fetched", () => {
		// An island is a client component: it needs nothing from `@lankajs/host`
		// except the one call that makes server data a screen's first state.
		renderWithLanka(<AtlasBoardIsland missions={FROM_THE_PAGE} />);

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined();
	});

	it("is interactive, which is the whole reason it is an island", () => {
		renderWithLanka(<AtlasBoardIsland missions={FROM_THE_PAGE} />);

		fireEvent.change(screen.getByLabelText("Search missions"), { target: { value: "depot" } });

		expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(screen.getByText("AT-102 Restock the depot")).toBeDefined();
	});

	it("hydrates once, so a second render cannot replace what a person is looking at", () => {
		const { rerender } = renderWithLanka(<AtlasBoardIsland missions={FROM_THE_PAGE} />);

		rerender(<AtlasBoardIsland missions={[mission("m-9", "Something else")]} />);

		expect(screen.queryByText("AT-109 Something else")).toBeNull();
	});
});
