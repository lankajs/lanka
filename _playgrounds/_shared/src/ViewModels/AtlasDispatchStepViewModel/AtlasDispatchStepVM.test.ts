import { describe, expect, it } from "vitest";
import { AtlasDispatchStepVM } from "./AtlasDispatchStepVM";
import { AtlasDispatchDraftStore } from "../../Core/SharedStores/AtlasDispatchDraftStore/AtlasDispatchDraftStore";
import { createAtlasCrewStepVM } from "../AtlasCrewStepViewModel/createAtlasCrewStepVM";

/** The two steps, over one draft — which is the arrangement under test. */
const dispatch = () => {
	const store = new AtlasDispatchDraftStore();

	return {
		store,
		useStep: new AtlasDispatchStepVM(store).build(),
		useCrewStep: createAtlasCrewStepVM(store),
	};
};

describe("two dispatch steps over one draft", () => {
	it("lets each step write the half of the draft it owns", () => {
		const { useStep, useCrewStep } = dispatch();

		useStep.getState().setTitle("Raise the relay mast");
		useCrewStep.getState().chooseCrew("c-2");

		expect(useCrewStep.getState().draft()).toMatchObject({
			title: "Raise the relay mast",
			crewId: "c-2",
		});
	});

	it("shows one state to both readers, rather than two answers to one question", () => {
		// Passing the draft down as props survives exactly one hop; duplicating it
		// into both ViewModels never survives at all — whichever writes last wins.
		const { useStep, useCrewStep } = dispatch();

		useStep.getState().setPriority(1);

		expect(useCrewStep.getState().priority).toBe(1);
		expect(useStep.getState().priority).toBe(1);
	});

	it("agrees about which step the person is on", () => {
		const { useStep, useCrewStep } = dispatch();

		useStep.getState().goToCrewStep();
		expect(useCrewStep.getState().step).toBe(2);

		useCrewStep.getState().goBack();
		expect(useStep.getState().step).toBe(1);
	});

	it("keeps two dispatches apart, because each has its own store", () => {
		const first = dispatch();
		const second = dispatch();

		first.useStep.getState().setTitle("Raise the mast");

		expect(second.useStep.getState().title).toBe("");
	});

	it("answers the DRAFT from `draft()`, not the draft with actions on top", () => {
		// `getStore`, not `get`. A sender handed the second would post the
		// ViewModel's own methods to the server.
		const { useCrewStep } = dispatch();

		expect(Object.keys(useCrewStep.getState().draft()).sort()).toEqual([
			"crewId",
			"priority",
			"step",
			"title",
		]);
	});
});
