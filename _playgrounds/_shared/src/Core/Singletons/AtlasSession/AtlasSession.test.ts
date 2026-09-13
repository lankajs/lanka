import { LankaError } from "lanka/errors";
import { createLankaEventRecorder, resetLanka } from "@lankajs/tool-testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtlasSession } from "./AtlasSession";
import type { AtlasSessionGateway } from "../../../Gateways/AtlasSessionGateway/AtlasSessionGateway";
import type { IAtlasCredentials } from "../../Interfaces/IAtlasCredentials";

const session = (serial: string): IAtlasCredentials => ({
	token: `token-${serial}`,
	refreshToken: `refresh-${serial}`,
	csrf: `csrf-${serial}`,
	name: "Ada",
});

const fakeGateway = (over: Partial<Record<string, unknown>> = {}) =>
	({
		open: vi.fn(() => Promise.resolve(session("1"))),
		renew: vi.fn(() => Promise.resolve(session("2"))),
		...over,
	}) as unknown as AtlasSessionGateway;

describe("AtlasSession", () => {
	beforeEach(() => {
		resetLanka();
	});

	it("holds nothing until somebody signs in", () => {
		const service = new AtlasSession(fakeGateway());

		expect(service.current()).toBeNull();
		expect(service.token()).toBeNull();
		expect(service.csrf()).toBeNull();
	});

	it("keeps what signing in answered", async () => {
		const service = new AtlasSession(fakeGateway());

		await service.signIn("Ada");

		expect(service.token()).toBe("token-1");
		expect(service.csrf()).toBe("csrf-1");
	});

	it("answers a BOOLEAN from renew, because that is what a retry ladder reads", async () => {
		// Throwing here would make a refusal the caller has to catch in the middle
		// of a retry, which is where nobody is looking.
		const service = new AtlasSession(fakeGateway());
		await service.signIn("Ada");

		expect(await service.renew()).toBe(true);
		expect(service.token()).toBe("token-2");
		expect(service.renewalCount()).toBe(1);
	});

	it("refuses to renew when there is nothing to renew with", async () => {
		const service = new AtlasSession(fakeGateway());

		expect(await service.renew()).toBe(false);
	});

	it("signs out and announces it when the refresh is refused", async () => {
		// Announced rather than acted on: what it MEANS differs per screen, and a
		// service that navigated would be making a decision that is not its to make.
		const events = createLankaEventRecorder();
		const service = new AtlasSession(
			fakeGateway({
				renew: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "http", message: "no", status: 401 })),
				),
			}),
		);
		await service.signIn("Ada");

		const renewed = await service.renew();

		expect(renewed).toBe(false);
		expect(service.current()).toBeNull();
		expect(events.of<{ reason: string }>("session.ended")).toEqual([{ reason: "expired" }]);
		events.stop();
	});

	it("tells an expiry from a sign-out, because the two need different interfaces", async () => {
		const events = createLankaEventRecorder();
		const service = new AtlasSession(fakeGateway());
		await service.signIn("Ada");

		service.signOut();

		expect(events.of<{ reason: string }>("session.ended")).toEqual([{ reason: "signed-out" }]);
		events.stop();
	});
});
