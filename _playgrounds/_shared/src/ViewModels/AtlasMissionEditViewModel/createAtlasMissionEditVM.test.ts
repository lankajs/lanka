import { LankaError } from "lanka/errors";
import { lankaScenarioBootstrap } from "lanka/scenario";
import { resetLanka } from "@lankajs/tool-testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAtlasMissionEditVM } from "./createAtlasMissionEditVM";
import { atlasMissionCompleted } from "../../Scenarios/Scenarios/AtlasMissionCompleted/AtlasMissionCompleted";
import type { AtlasMissionGateway } from "../../Gateways/AtlasMissionGateway/AtlasMissionGateway";
import type { IAtlasMission } from "../../Core/Interfaces/IAtlasMission";

const mission = (over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id: "m-1",
	code: "AT-101",
	title: "Survey the north ridge",
	status: "active",
	priority: 1,
	crewId: "c-1",
	updatedAt: "2026-09-13T00:00:00.000Z",
	...over,
});

const fakeGateway = (over: Partial<Record<string, unknown>> = {}) =>
	({
		byId: vi.fn(() => Promise.resolve(mission())),
		rename: vi.fn((_id: string, title: string) =>
			Promise.resolve(mission({ title, updatedAt: "2026-09-13T01:00:00.000Z" })),
		),
		...over,
	}) as unknown as AtlasMissionGateway;

const bound = async (gateway: AtlasMissionGateway) => {
	const useVM = createAtlasMissionEditVM(gateway);
	useVM.getState();
	await resetLanka().bootstrap();
	lankaScenarioBootstrap.bootstrap();

	return useVM;
};

describe("createAtlasMissionEditVM", () => {
	beforeEach(() => {
		resetLanka();
	});

	it("holds the server's version, which is what a form's defaults are", async () => {
		const useVM = createAtlasMissionEditVM(fakeGateway());

		await useVM.getState().fetchMission("m-1");

		expect(useVM.getState().server?.title).toBe("Survey the north ridge");
	});

	it("holds no field values at all", async () => {
		// Under server rendering that is not a preference: a ViewModel is a store
		// created at module level, which on a server is one store shared by every
		// request.
		const useVM = createAtlasMissionEditVM(fakeGateway());
		await useVM.getState().fetchMission("m-1");

		expect(Object.keys(useVM.getState())).not.toContain("title");
	});

	it("answers the saved mission to whoever submitted", async () => {
		const useVM = createAtlasMissionEditVM(fakeGateway());
		await useVM.getState().fetchMission("m-1");

		const outcome = await useVM.getState().submit({
			title: "Survey the south ridge",
			priority: 1,
			crewId: "c-1",
		});

		expect(outcome).toEqual({
			ok: true,
			data: mission({
				title: "Survey the south ridge",
				updatedAt: "2026-09-13T01:00:00.000Z",
			}),
		});
	});

	it("clears the submitting flag even when the save failed", async () => {
		const useVM = createAtlasMissionEditVM(
			fakeGateway({
				rename: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "No connection" })),
				),
			}),
		);
		await useVM.getState().fetchMission("m-1");

		await useVM.getState().submit({ title: "anything", priority: 1, crewId: null });

		expect(useVM.getState().isSubmitting).toBe(false);
		expect(useVM.getState().screenError).toBe("No connection");
	});

	it("hands a 422 to the form with the addresses on it, and shows nothing on the screen", async () => {
		const useVM = createAtlasMissionEditVM(
			fakeGateway({
				rename: vi.fn(() =>
					Promise.reject(
						new LankaError({
							kind: "http",
							message: "cannot be saved",
							status: 422,
							fields: [
								{ path: ["title"], message: "a title is at least 4 characters" },
							],
						}),
					),
				),
			}),
		);
		await useVM.getState().fetchMission("m-1");

		const outcome = await useVM.getState().submit({ title: "no", priority: 1, crewId: null });

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.fields[0].path).toEqual(["title"]);
		expect(useVM.getState().screenError).toBeNull();
	});

	it("MARKS a change that arrived from elsewhere instead of writing it into the form", async () => {
		// Resetting the form automatically erases what somebody is typing; ignoring
		// the change hands them a conflict on save. The screen offers a reload and
		// the person decides.
		const useVM = await bound(fakeGateway());
		await useVM.getState().fetchMission("m-1");

		atlasMissionCompleted.trigger({
			id: "m-1",
			mission: mission({
				title: "Somebody else's title",
				updatedAt: "2026-09-13T02:00:00.000Z",
			}),
		});

		expect(useVM.getState().serverChangedAt).toBe("2026-09-13T02:00:00.000Z");
		expect(useVM.getState().server?.title).toBe("Somebody else's title");
	});

	it("stays quiet about its OWN save", async () => {
		// The write is marked before it is announced, so a handler hearing it
		// recognises it — by id and version, never by reference.
		const useVM = await bound(fakeGateway());
		await useVM.getState().fetchMission("m-1");

		await useVM
			.getState()
			.submit({ title: "Survey the south ridge", priority: 1, crewId: null });

		expect(useVM.getState().serverChangedAt).toBeNull();
	});

	it("ignores a fact about a different mission", async () => {
		const useVM = await bound(fakeGateway());
		await useVM.getState().fetchMission("m-1");

		atlasMissionCompleted.trigger({ id: "m-9", mission: mission({ id: "m-9" }) });

		expect(useVM.getState().serverChangedAt).toBeNull();
	});

	it("takes the newer version when the person asks for it", async () => {
		const useVM = await bound(fakeGateway());
		await useVM.getState().fetchMission("m-1");
		atlasMissionCompleted.trigger({
			id: "m-1",
			mission: mission({ updatedAt: "2026-09-13T02:00:00.000Z" }),
		});

		useVM.getState().applyServerVersion();

		expect(useVM.getState().serverChangedAt).toBeNull();
	});
});
