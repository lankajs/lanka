import { LankaError } from "lanka/errors";
import { AtlasMissionGateway } from "@lanka-playgrounds/_shared";
import { renderWithLanka } from "@lankajs/tool-testing";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AtlasMissionForm } from "./AtlasMissionForm";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

const mission: IAtlasMission = {
	id: "m-1",
	code: "AT-101",
	title: "Survey the north ridge",
	status: "active",
	priority: 1,
	crewId: "c-1",
	updatedAt: "2026-09-13T00:00:00.000Z",
};

/**
 * The gateway is replaced on its PROTOTYPE.
 *
 * The ViewModel this form reads is declared at module level — which is what a
 * client component does, and what makes the "one store per tab" rule visible —
 * so the gateway it holds cannot be handed in per test. Replacing the method is
 * the seam that is left, and it is honest: a test double stands where the
 * network would be, and nothing above the gateway changes.
 */
const answerWith = (answer: () => Promise<IAtlasMission>) =>
	vi.spyOn(AtlasMissionGateway.prototype, "rename").mockImplementation(answer);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

beforeEach(() => {
	answerWith(() => Promise.resolve({ ...mission, title: "Survey the south ridge" }));
});

describe("AtlasMissionForm", () => {
	it("starts from the server's version, which is what a form's defaults are", () => {
		renderWithLanka(<AtlasMissionForm mission={mission} />);

		expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe(
			"Survey the north ridge",
		);
	});

	it("keeps the values in the COMPONENT, not in the ViewModel", () => {
		// A ViewModel is a store created at module level: one per process, which on
		// a server is one shared by every request. An empty form survives that; one
		// pre-filled with somebody's mission hands the next visitor theirs.
		renderWithLanka(<AtlasMissionForm mission={mission} />);

		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Something else" } });

		expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Something else");
	});

	it("says so when the save went through", async () => {
		renderWithLanka(<AtlasMissionForm mission={mission} />);

		fireEvent.submit(screen.getByLabelText("Edit mission"));

		await waitFor(() => expect(screen.getByTestId("saved")).toBeDefined());
	});

	it("puts a 422 under the input it belongs to, and nothing in the banner", async () => {
		answerWith(() =>
			Promise.reject(
				new LankaError({
					kind: "http",
					message: "this mission cannot be saved",
					status: 422,
					fields: [{ path: ["title"], message: "a title is at least 4 characters" }],
				}),
			),
		);
		renderWithLanka(<AtlasMissionForm mission={mission} />);

		fireEvent.submit(screen.getByLabelText("Edit mission"));

		await waitFor(() =>
			expect(screen.getByTestId("title-error").textContent).toBe(
				"a title is at least 4 characters",
			),
		);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("puts a connection failure in the banner, because no input owns the network", async () => {
		answerWith(() =>
			Promise.reject(new LankaError({ kind: "network", message: "No connection to Atlas" })),
		);
		renderWithLanka(<AtlasMissionForm mission={mission} />);

		fireEvent.submit(screen.getByLabelText("Edit mission"));

		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toBe("No connection to Atlas"),
		);
		expect(screen.queryByTestId("title-error")).toBeNull();
	});
});
