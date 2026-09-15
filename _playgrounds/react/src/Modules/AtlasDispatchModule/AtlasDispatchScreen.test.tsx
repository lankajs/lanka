import {
	AtlasDispatchDraftStore,
	AtlasDispatchStepVM,
	createAtlasCrewStepVM,
} from "@lanka-playgrounds/_shared";
import { renderWithLanka } from "@lankajs/react/testing";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasDispatchScreen } from "./AtlasDispatchScreen";
import type { IAtlasDispatchDraft } from "@lanka-playgrounds/_shared";

const renderScreen = (onPlace: (draft: IAtlasDispatchDraft) => void = vi.fn()) => {
	const store = new AtlasDispatchDraftStore();

	return renderWithLanka(
		<AtlasDispatchScreen
			stepVM={new AtlasDispatchStepVM(store).build()}
			crewStepVM={createAtlasCrewStepVM(store)}
			onPlace={onPlace}
		/>,
	);
};

afterEach(() => {
	cleanup();
});

describe("AtlasDispatchScreen", () => {
	it("starts on the first step", () => {
		renderScreen();

		expect(screen.getByLabelText("Mission title")).toBeDefined();
	});

	it("carries what was typed on step one into step two", async () => {
		// Neither ViewModel imports the other and neither knows the other is
		// mounted. What they share is a BUFFER, which is the one link a shared
		// store is for — a scenario carries something that HAPPENED.
		renderScreen();

		fireEvent.change(screen.getByLabelText("Mission title"), {
			target: { value: "Raise the relay mast" },
		});
		fireEvent.click(screen.getByText("Choose the crew"));

		await waitFor(() =>
			expect(screen.getByTestId("draft-title").textContent).toBe("Raise the relay mast"),
		);
	});

	it("goes back without losing the draft", async () => {
		renderScreen();
		fireEvent.change(screen.getByLabelText("Mission title"), {
			target: { value: "Raise the relay mast" },
		});
		fireEvent.click(screen.getByText("Choose the crew"));
		await waitFor(() => expect(screen.getByText("Back")).toBeDefined());

		fireEvent.click(screen.getByText("Back"));

		await waitFor(() =>
			expect(screen.getByLabelText<HTMLInputElement>("Mission title").value).toBe(
				"Raise the relay mast",
			),
		);
	});

	it("hands the whole draft to whoever places it, and orchestrates nothing itself", async () => {
		const onPlace = vi.fn();
		renderScreen(onPlace);
		fireEvent.change(screen.getByLabelText("Mission title"), {
			target: { value: "Raise the relay mast" },
		});
		fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "1" } });
		fireEvent.click(screen.getByText("Choose the crew"));
		await waitFor(() => expect(screen.getByLabelText("Crew")).toBeDefined());
		fireEvent.change(screen.getByLabelText("Crew"), { target: { value: "c-2" } });

		fireEvent.click(screen.getByText("Place the dispatch"));

		expect(onPlace).toHaveBeenCalledWith({
			title: "Raise the relay mast",
			priority: 1,
			crewId: "c-2",
			step: 2,
		});
	});

	it("can put the crew back to nobody", async () => {
		const onPlace = vi.fn();
		renderScreen(onPlace);
		fireEvent.click(screen.getByText("Choose the crew"));
		await waitFor(() => expect(screen.getByLabelText("Crew")).toBeDefined());

		fireEvent.change(screen.getByLabelText("Crew"), { target: { value: "c-1" } });
		fireEvent.change(screen.getByLabelText("Crew"), { target: { value: "" } });
		fireEvent.click(screen.getByText("Place the dispatch"));

		expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ crewId: null }));
	});
});
