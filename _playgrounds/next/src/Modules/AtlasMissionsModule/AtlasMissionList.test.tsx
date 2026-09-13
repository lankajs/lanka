import { renderWithLanka } from "@lankajs/tool-testing";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AtlasMissionList } from "./AtlasMissionList";
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

const SERVER_DATA = [mission("m-1", "Survey the north ridge"), mission("m-2", "Restock the depot")];

afterEach(() => {
	cleanup();
});

describe("AtlasMissionList", () => {
	it("renders what the server already had, with no second request", () => {
		// The handoff is DATA, not state: the page fetched inside a scope, handed
		// the result down as a prop, and hydration made it the first state a screen
		// reads. Nothing here has a gateway to call.
		renderWithLanka(<AtlasMissionList missions={SERVER_DATA} />);

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined();
	});

	it("hydrates ONCE, however many times React renders it", async () => {
		// React renders a component twice in StrictMode and again on every
		// re-render. A second hydration is a no-op rather than a throw, because a
		// throw would turn correct code into a crash visible only in development.
		const { rerender } = renderWithLanka(<AtlasMissionList missions={SERVER_DATA} />);

		rerender(<AtlasMissionList missions={[mission("m-9", "Something else entirely")]} />);

		await waitFor(() =>
			expect(screen.getByText("AT-101 Survey the north ridge")).toBeDefined(),
		);
		expect(screen.queryByText("AT-109 Something else entirely")).toBeNull();
	});

	it("filters what the server sent, in the browser", () => {
		renderWithLanka(<AtlasMissionList missions={SERVER_DATA} />);

		fireEvent.change(screen.getByLabelText("Search missions"), { target: { value: "depot" } });

		expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(screen.getByText("AT-102 Restock the depot")).toBeDefined();
	});
});
