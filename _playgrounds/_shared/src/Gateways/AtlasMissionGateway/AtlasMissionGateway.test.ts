import { LankaError } from "lanka/errors";
import { LankaFetchJsonRequest } from "lanka/gateway";
import { LankaValidationError } from "lanka/validation";
import { createLankaFakeTransport } from "@lankajs/tool-testing";
import { beforeEach, describe, expect, it } from "vitest";
import { AtlasMissionGateway } from "./AtlasMissionGateway";
import type { IAtlasMission } from "../../Core/Interfaces/IAtlasMission";

const mission: IAtlasMission = {
	id: "m-1",
	code: "AT-101",
	title: "Survey the north ridge",
	status: "active",
	priority: 1,
	crewId: "c-1",
	updatedAt: "2026-09-13T00:00:00.000Z",
};

/** A gateway over a transport that never leaves the process. */
const gatewayOver = (transport: ReturnType<typeof createLankaFakeTransport>) =>
	new AtlasMissionGateway(new LankaFetchJsonRequest({ transport }));

describe("AtlasMissionGateway", () => {
	let transport: ReturnType<typeof createLankaFakeTransport>;

	beforeEach(() => {
		transport = createLankaFakeTransport({ body: [mission] });
	});

	it("asks the endpoint its base path names", async () => {
		await gatewayOver(transport).list();

		expect(transport.calls[0].endpoint).toBe("https://api.test/missions");
	});

	it("checks every row before anybody reads it", async () => {
		// A gateway is where a body stops being `unknown`. Validating in the screen
		// instead spreads the same guards over every consumer, each slightly
		// differently wrong.
		const broken = createLankaFakeTransport({ body: [{ ...mission, priority: 99 }] });

		await expect(gatewayOver(broken).list()).rejects.toThrow(LankaValidationError);
	});

	it("builds a query through the gateway's own builder", async () => {
		await gatewayOver(transport).byStatus("queued");

		expect(transport.calls[0].endpoint).toBe("https://api.test/missions?status=queued");
	});

	it("reads one mission by its id", async () => {
		const one = createLankaFakeTransport({ body: mission });

		expect((await gatewayOver(one).byId("m-1")).title).toBe("Survey the north ridge");
	});

	it("maps the legacy shape in two steps, and needs no adapter for either", async () => {
		const legacy = createLankaFakeTransport({
			body: {
				rows: [
					{
						mission_id: "m-4",
						mission_title: "Map the flood plain",
						mission_state: "DONE",
						assigned_to: "c-3",
						changed_at: 1_700_000_000,
					},
				],
			},
		});

		const missions = await gatewayOver(legacy).listFromLegacyApi();

		expect(missions[0]).toMatchObject({ id: "m-4", status: "done", crewId: "c-3" });
	});

	it("checks the payload with the schema the FORM uses, before sending", async () => {
		// The same object read twice: once where somebody types and once on the way
		// out. Declaring the rule twice is how a client and a server come to
		// disagree about what a valid mission is.
		const created = createLankaFakeTransport({ body: mission });

		await expect(
			gatewayOver(created).create({ title: "no", priority: 1, crewId: null }),
		).rejects.toThrow(LankaValidationError);
		expect(created.calls).toHaveLength(0);
	});

	it("sends a create as a POST carrying the checked payload", async () => {
		const created = createLankaFakeTransport({ body: mission });

		await gatewayOver(created).create({ title: "Clear the strip", priority: 2, crewId: null });

		expect(created.calls[0].options?.method).toBe("POST");
		expect(created.calls[0].options?.body).toMatchObject({ title: "Clear the strip" });
	});

	it("refuses locally in the same shape the server refuses in", async () => {
		// A screen then has ONE failure shape to render, whether the no came from
		// here or from the far end.
		const failure = await gatewayOver(transport)
			.assign("", "c-1")
			.catch((error: unknown) => error);

		expect(LankaError.is(failure)).toBe(true);
		expect(transport.calls).toHaveLength(0);
	});

	it("passes a caller's signal through, or nothing is ever cancelled", async () => {
		const controller = new AbortController();

		await gatewayOver(transport).list({ signal: controller.signal });

		expect(transport.calls[0].options?.signal).toBeDefined();
	});
});
