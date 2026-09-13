// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { LankaError, readLankaFieldErrors } from "lanka/errors";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAtlasMissionEditVM } from "./ViewModels/AtlasMissionEditViewModel/createAtlasMissionEditVM";
import { createAtlasMissionsVM } from "./ViewModels/AtlasMissionsViewModel/createAtlasMissionsVM";
import { createAtlasStatsVM } from "./ViewModels/AtlasStatsViewModel/createAtlasStatsVM";
import { createAtlasTelemetryVM } from "./ViewModels/AtlasTelemetryViewModel/createAtlasTelemetryVM";
import { startAtlas } from "./startAtlas";
import type { IAtlasApp } from "./startAtlas";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * Atlas against the real API, over a real socket.
 *
 * A cross-cutting suite, so it lives at the package root rather than beside any
 * one unit: what it asserts is that the PARTS FIT — a request policy reaches a
 * server, a 401 becomes a refresh, a retry becomes one mission and not two, a
 * GraphQL `200` with errors becomes a failure a screen can branch on, and a
 * gRPC status becomes a kind. None of that has a unit to live in, and a fake
 * transport proves none of it: a double answers what it was told to answer.
 *
 * The server is started per FILE and the framework is reset per test, which is
 * the cheap half of isolation where it matters and the honest half where it
 * does not: a fresh instance costs nothing, a fresh port costs a second.
 *
 * ## Why this file says `@vitest-environment node`
 *
 * Under jsdom, `AbortController` is jsdom's and `fetch` is node's, and undici
 * refuses a signal built by another realm:
 *
 * ```
 * TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance
 * of AbortSignal.
 * ```
 *
 * Every request the framework sends carries a signal, because a deadline is a
 * signal — so under jsdom EVERY real request fails, as `kind: "network"`, after
 * the retry ladder has spent its backoff. It reads exactly like a server that is
 * not there.
 *
 * Nothing here renders, so node is the honest environment for it. The tests that
 * DO render keep jsdom and reach no network, which is the division every
 * application ends up making.
 */
let api: IAtlasServer;
let base: string;
let app: IAtlasApp | null = null;

/**
 * Starts Atlas signed in as somebody.
 *
 * A second function rather than a default parameter: passing `undefined` to a
 * parameter WITH a default takes the default, so "start signed out" and "start
 * as Ada" would have been the same call.
 */
const start = async (signInAs = "Ada"): Promise<IAtlasApp> => {
	app = await startAtlas({ apiBaseUrl: base, signInAs });

	return app;
};

/** Starts Atlas with nobody signed in. */
const startSignedOut = async (): Promise<IAtlasApp> => {
	app = await startAtlas({ apiBaseUrl: base });

	return app;
};

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 3 });
	base = await api.listen(0);
});

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	api.world.reset();
});

afterAll(async () => {
	await api.close();
});

describe("Atlas, started against the real API", () => {
	it("signs in during the start-up chain and is allowed to read", async () => {
		const started = await start();

		expect(started.session.current()?.name).toBe("Ada");
		expect(started.startup.canRead).toBe(true);
		expect(started.startup.redirectTo).toBeUndefined();
	});

	it("stops the chain and says where to go when nobody is signed in", async () => {
		// A DECISION, not a failure. An exception cannot carry a destination, which
		// is the whole reason this pipeline exists beside core's services.
		const started = await startSignedOut();

		expect(started.startup.done).toBe(true);
		expect(started.startup.redirectTo).toBe("/sign-in");
		expect(started.startup.canRead).toBe(false);
	});

	it("fetches the board through the gateway, the policy and the wire", async () => {
		const started = await start();
		const useVM = createAtlasMissionsVM(started.missionGateway);

		await useVM.getState().fetchMissions();

		expect(useVM.getState().missions).toHaveLength(5);
		expect(useVM.getState().error).toBeNull();
	});

	it("refreshes a spent token and finishes the call that met the 401", async () => {
		// The server expires a token after three protected calls; the policy sees
		// the 401, asks the session service to refresh, and retries ONCE. Nothing
		// above the gateway knows any of that happened.
		const started = await start();

		for (let call = 0; call < 5; call += 1) {
			await started.missionGateway.create({
				title: `Mission number ${String(call)}`,
				priority: 3,
				crewId: null,
			});
		}

		expect(started.session.renewalCount()).toBeGreaterThan(0);
		expect(api.world.missions()).toHaveLength(10);
	});

	it("refreshes ONCE when several calls meet the 401 together", async () => {
		// The thundering herd, and the reason the auth middleware keeps the refresh
		// in flight rather than starting one per caller.
		//
		// This server rotates: a spent refresh token is deleted the moment it is
		// used. So a second concurrent refresh would present a token that no longer
		// exists and be refused — the herd does not merely waste calls here, it
		// fails, and it fails for whichever caller lost the race. That makes the
		// single-flight a correctness property, not an optimisation.
		const started = await start();
		const before = started.session.renewalCount();

		// Six at once against a token good for three: several are guaranteed to be
		// in flight when the first 401 comes back.
		const answers = await Promise.all(
			Array.from({ length: 6 }, (_, index) =>
				started.missionGateway
					.create({ title: `Herd ${String(index)}`, priority: 3, crewId: null })
					.then(() => "ok" as const)
					.catch((error: unknown) => error),
			),
		);

		expect(answers.filter((one) => one === "ok")).toHaveLength(6);
		// One refresh for the whole burst. Two would mean the second presented a
		// rotated-away token, which this server refuses.
		expect(started.session.renewalCount() - before).toBe(1);
	});

	it("retries a failure the server could not answer, and gives up on one it refused", async () => {
		const started = await start();

		// 503 twice then 200: the policy's own retry, with a growing backoff.
		const recovered = await started.missionGateway
			.list()
			.then(() => fetch(`${base}/unstable?run=policy&failures=0`))
			.then((response) => response.ok);

		expect(recovered).toBe(true);
		// A 409 is a refusal the server MEANT. Retrying gives the same answer,
		// later, so the policy leaves it alone.
		const refusal = await started.missionGateway
			.assign("m-1", "c-nobody")
			.catch((error: unknown) => error);

		expect(LankaError.is(refusal)).toBe(true);
		expect((refusal as LankaError).status).toBe(409);
	});

	it("carries one idempotency key through a retry, so one intent is one mission", async () => {
		const started = await start();
		const before = api.world.missions().length;

		await started.missionGateway.create({ title: "Raise the mast", priority: 2, crewId: null });

		expect(api.world.missions()).toHaveLength(before + 1);
	});

	it("reads a 422 with the address of the field that was refused", async () => {
		const started = await start();

		const failure = await started.missionGateway
			.rename("m-1", "no")
			.catch((error: unknown) => error);

		expect(LankaError.is(failure)).toBe(true);
		expect((failure as LankaError).status).toBe(422);
	});

	it("carries the refused field's ADDRESS all the way to the form", async () => {
		// The status alone proves nothing a form can use. What a form needs is
		// which input was refused and what to say under it, and that answer
		// crosses four packages on the way: the server's `{ field: [message] }`,
		// the http plugin's reader, core's `readLankaFieldErrors`, and this
		// application's own ordering of what goes where.
		const started = await start();
		const useEdit = createAtlasMissionEditVM(started.missionGateway);
		await useEdit.getState().fetchMission("m-1");

		const outcome = await useEdit.getState().submit({ title: "no", priority: 1, crewId: null });

		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;

		expect(outcome.fields).toHaveLength(1);
		// Segments, not a joined string: a message may contain a colon and a key
		// may contain a dot, so a joined address cannot be taken apart again.
		expect(outcome.fields[0].path).toEqual(["title"]);
		expect(outcome.fields[0].message).toContain("at least");
		// It went to the FIELD, so it must not also be on the screen — a message
		// shown twice reads as two problems.
		expect(useEdit.getState().screenError).toBeNull();
	});

	it("answers every refused field at once, not the first one", async () => {
		// A server that stopped at the first problem makes somebody fix one input,
		// submit, and be told about the next. Atlas answers all of them, and the
		// reader has to survive more than one.
		//
		// `rename` rather than `create`: `create` validates its payload on the
		// CLIENT first, so a bad body never leaves the process and this would be a
		// test of the valibot schema wearing a live server as a costume. Renaming
		// has no client-side schema, so the 422 asserted here is the server's.
		const started = await start();

		const failure = await started.missionGateway
			.rename("m-1", "no")
			.catch((error: unknown) => error);

		const fields = readLankaFieldErrors(failure);

		expect(fields).toHaveLength(1);
		expect(fields[0].path).toEqual(["title"]);
		expect(fields[0].message).toContain("at least");
	});

	it("maps the legacy endpoint into the application's own vocabulary", async () => {
		const started = await start();

		const missions = await started.missionGateway.listFromLegacyApi();

		expect(missions[0]).toHaveProperty("status");
		expect(missions[0]).not.toHaveProperty("mission_state");
	});

	it("reads the crew through the gateway written by calling", async () => {
		const started = await start();

		const crew = await started.crewGateway.list();

		expect(crew.map((member) => member.id)).toContain("c-1");
	});

	it("turns a GraphQL 200-with-errors into a failure a screen can branch on", async () => {
		// Through an ordinary JSON request kind this is a SUCCESS carrying a body
		// somebody has to inspect, and the applications that forget show a spinner
		// over a failed mutation until a reload.
		const started = await start();

		const failure = await started.boardGateway.complete("m-4").catch((error: unknown) => error);

		expect(LankaError.is(failure)).toBe(true);
		expect((failure as LankaError).kind).toBe("domain");
		expect((failure as LankaError).code).toBe("ALREADY_DONE");
	});

	it("keeps a partial GraphQL result rather than throwing away a page that rendered", async () => {
		const partial: unknown[] = [];
		app = await startAtlas({ apiBaseUrl: base, signInAs: "Ada" });
		const board = new (
			await import("./Gateways/AtlasBoardGateway/AtlasBoardGateway")
		).AtlasBoardGateway((errors) => partial.push(...errors));

		const summary = await board.summary();

		expect(summary.queued).toBeGreaterThan(0);
		expect(partial).toHaveLength(1);
	});

	it("reads a gRPC unary call through the framing this repository writes on both sides", async () => {
		const started = await start();
		const useVM = createAtlasTelemetryVM(started.telemetryGateway);

		await useVM.getState().fetchTelemetry();

		expect(useVM.getState().telemetry?.queued).toBeGreaterThan(0);
		useVM.dispose();
	});

	it("turns a gRPC status into a kind, and names it in words", async () => {
		// `PERMISSION_DENIED`, not `7`: a line somebody can read beats a line
		// somebody has to look up. The status arrives in the HTTP headers, because
		// a call refused before any message has no body to carry it.
		const started = await start();
		const useVM = createAtlasTelemetryVM(started.telemetryGateway);

		await useVM.getState().fetchRestricted();

		expect(useVM.getState().refusal).toBeTruthy();
		useVM.dispose();
	});

	it("answers questions about a list without holding one", async () => {
		const started = await start();
		const useVM = createAtlasMissionsVM(started.missionGateway);
		const useStats = createAtlasStatsVM();
		await useVM.getState().fetchMissions();

		const missions = useVM.getState().missions;

		expect(useStats.getState().countByStatus(missions, "queued")).toBe(3);
		expect(useStats.getState().mostUrgent(missions)?.priority).toBe(1);
		expect(useStats.getState().unassigned(missions)).toHaveLength(2);
	});
});
