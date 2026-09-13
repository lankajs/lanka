import { describe, expect, it } from "vitest";
import { AtlasSessions } from "./AtlasSessions";

describe("AtlasSessions", () => {
	it("hands a signed-in person a token, a refresh token and a csrf value", () => {
		const session = new AtlasSessions().open("Ada");

		expect(session.token).not.toBe(session.refreshToken);
		expect(session.csrf).not.toBe(session.token);
		expect(session.name).toBe("Ada");
	});

	it("gives two people different tokens", () => {
		const sessions = new AtlasSessions();

		expect(sessions.open("Ada").token).not.toBe(sessions.open("Grace").token);
	});

	it("expires a token after a stated number of calls rather than after a duration", () => {
		// A clock would make this test either sleep or never reach the branch.
		const sessions = new AtlasSessions({ callsPerToken: 2 });
		const session = sessions.open("Ada");

		expect(sessions.spend(session.token)).not.toBeNull();
		expect(sessions.spend(session.token)).not.toBeNull();
		expect(sessions.spend(session.token)).toBeNull();
	});

	it("keeps refusing a spent token, so a retry cannot hide a refresh that never happened", () => {
		const sessions = new AtlasSessions({ callsPerToken: 0 });
		const session = sessions.open("Ada");

		sessions.spend(session.token);
		sessions.spend(session.token);

		expect(sessions.spend(session.token)).toBeNull();
	});

	it("refuses a token nobody issued", () => {
		expect(new AtlasSessions().spend("atlas-token-forged")).toBeNull();
		expect(new AtlasSessions().spend(undefined)).toBeNull();
	});

	it("exchanges a refresh token for a usable access token", () => {
		const sessions = new AtlasSessions({ callsPerToken: 1 });
		const first = sessions.open("Ada");
		sessions.spend(first.token);
		sessions.spend(first.token);

		const second = sessions.refresh(first.refreshToken);

		expect(second).not.toBeNull();
		expect(second?.name).toBe("Ada");
		expect(sessions.spend(second?.token)).not.toBeNull();
	});

	it("rotates the refresh token, so the old one cannot be used twice", () => {
		const sessions = new AtlasSessions();
		const first = sessions.open("Ada");

		sessions.refresh(first.refreshToken);

		expect(sessions.refresh(first.refreshToken)).toBeNull();
	});

	it("refuses a refresh token nobody issued", () => {
		expect(new AtlasSessions().refresh("atlas-refresh-forged")).toBeNull();
		expect(new AtlasSessions().refresh(undefined)).toBeNull();
	});

	it("finds the session a csrf value belongs to, and no session for a wrong one", () => {
		const sessions = new AtlasSessions();
		const session = sessions.open("Ada");

		expect(sessions.bearing(session.csrf)?.token).toBe(session.token);
		expect(sessions.bearing("atlas-csrf-forged")).toBeUndefined();
		expect(sessions.bearing(undefined)).toBeUndefined();
	});
});
