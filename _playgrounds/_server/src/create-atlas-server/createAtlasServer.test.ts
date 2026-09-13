import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAtlasServer } from "./createAtlasServer";
import type { IAtlasServer } from "./createAtlasServer";

let api: IAtlasServer;
let base: string;

/**
 * The body as a shape the test names.
 *
 * `Response.json()` answers `unknown` under these typings, which is correct and
 * says the same thing at nineteen call sites. One named reader says it once.
 */
const jsonOf = async <T>(response: Response): Promise<T> => (await response.json()) as T;

/** Signs in and answers the headers an unsafe call needs. */
const signedIn = async (): Promise<Record<string, string>> => {
	const response = await fetch(`${base}/session`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ name: "Ada" }),
	});
	const session = await jsonOf<{ token: string; csrf: string }>(response);

	return {
		"content-type": "application/json",
		authorization: `Bearer ${session.token}`,
		"x-atlas-csrf": session.csrf,
	};
};

beforeAll(async () => {
	// Port 0: the operating system picks a free one. A fixed port makes a suite
	// fail on a machine where something else already holds it, and the failure
	// reads as a broken server.
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
});

afterAll(async () => {
	await api.close();
});

describe("the atlas API over a real socket", () => {
	it("serves the missions", async () => {
		const missions = (await (await fetch(`${base}/missions`)).json()) as unknown[];

		expect(missions.length).toBeGreaterThan(0);
	});

	it("filters by status when asked", async () => {
		const done = (await (await fetch(`${base}/missions?status=done`)).json()) as {
			status: string;
		}[];

		expect(done.every((mission) => mission.status === "done")).toBe(true);
	});

	it("answers 404 for a mission that is not there", async () => {
		expect((await fetch(`${base}/missions/m-nope`)).status).toBe(404);
	});

	it("answers 404 for anything outside the API prefix", async () => {
		const root = base.replace(/\/api$/, "");

		expect((await fetch(`${root}/somewhere`)).status).toBe(404);
	});

	it("refuses an unsafe call with no session", async () => {
		const response = await fetch(`${base}/missions`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Clear the strip" }),
		});

		expect(response.status).toBe(401);
		expect((await jsonOf<{ code: string }>(response)).code).toBe("TOKEN_EXPIRED");
	});

	it("asks a bearer caller for no further proof", async () => {
		// Nothing attaches a bearer token to a request from somebody else's page,
		// so a CSRF header would prove what the token already proves. A server that
		// demanded one from everybody would make the wrong request policy look
		// necessary.
		const headers = await signedIn();
		delete headers["x-atlas-csrf"];

		const response = await fetch(`${base}/missions`, {
			method: "POST",
			headers,
			body: JSON.stringify({ title: "Clear the strip" }),
		});

		expect(response.status).toBe(201);
	});

	it("refuses a COOKIE caller who proves nothing about where the request came from", async () => {
		// The browser attached the cookie by itself, which is exactly what a page
		// on another origin can make it do.
		const opened = await fetch(`${base}/session`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Ada" }),
		});
		const cookie = opened.headers.get("set-cookie")?.split(";")[0] ?? "";

		const response = await fetch(`${base}/missions`, {
			method: "POST",
			headers: { "content-type": "application/json", cookie },
			body: JSON.stringify({ title: "Clear the strip" }),
		});

		expect(response.status).toBe(403);
		expect((await jsonOf<{ code: string }>(response)).code).toBe("CSRF_MISSING");
	});

	it("accepts a cookie caller who carries the header the application put there", async () => {
		const opened = await fetch(`${base}/session`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Ada" }),
		});
		const session = await jsonOf<{ csrf: string }>(opened);
		const cookie = opened.headers.get("set-cookie")?.split(";")[0] ?? "";

		const response = await fetch(`${base}/missions`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie,
				"x-atlas-csrf": session.csrf,
			},
			body: JSON.stringify({ title: "Clear the strip" }),
		});

		expect(response.status).toBe(201);
	});

	it("prefers the header when a caller sends both", async () => {
		// A browser sends the cookie whether or not anybody meant it to. A caller
		// who took the trouble to set a header is the one who said what they meant.
		const opened = await fetch(`${base}/session`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Ada" }),
		});
		const session = await jsonOf<{ token: string }>(opened);
		const cookie = opened.headers.get("set-cookie")?.split(";")[0] ?? "";

		const me = await fetch(`${base}/me`, {
			headers: { cookie, authorization: `Bearer ${session.token}` },
		});

		expect((await jsonOf<{ viaCookie: boolean }>(me)).viaCookie).toBe(false);
	});

	it("creates a mission for a caller who is signed in and proved it", async () => {
		const response = await fetch(`${base}/missions`, {
			method: "POST",
			headers: await signedIn(),
			body: JSON.stringify({ title: "Clear the landing strip", priority: 2 }),
		});

		expect(response.status).toBe(201);
		expect((await jsonOf<{ title: string }>(response)).title).toBe("Clear the landing strip");
	});

	it("answers a 422 with a message per field", async () => {
		const response = await fetch(`${base}/missions`, {
			method: "POST",
			headers: await signedIn(),
			body: JSON.stringify({ title: "no", priority: 99 }),
		});

		expect(response.status).toBe(422);
		const body = (await response.json()) as { errors: Record<string, string[]> };
		expect(Object.keys(body.errors).sort()).toEqual(["priority", "title"]);
	});

	it("creates once for one idempotency key, however many times it is sent", async () => {
		// The other half of the contract `@lankajs/plugin-http` keeps: it mints one
		// key per intent and sends it on every attempt, which only prevents a
		// second mission if the server remembers the first.
		const headers = { ...(await signedIn()), "idempotency-key": "atlas-key-1" };
		const body = JSON.stringify({ title: "Raise the mast again" });

		const first = (await (
			await fetch(`${base}/missions`, { method: "POST", headers, body })
		).json()) as {
			id: string;
		};
		const second = (await (
			await fetch(`${base}/missions`, { method: "POST", headers, body })
		).json()) as {
			id: string;
		};

		expect(second.id).toBe(first.id);
	});

	it("refuses a crew member who is not on the roster, and means it", async () => {
		const response = await fetch(`${base}/missions/m-2/assign`, {
			method: "POST",
			headers: await signedIn(),
			body: JSON.stringify({ crewId: "c-nobody" }),
		});

		expect(response.status).toBe(409);
		expect((await jsonOf<{ code: string }>(response)).code).toBe("NO_SUCH_CREW");
	});

	it("serves the legacy shape, which is a different vocabulary for one world", async () => {
		const body = (await (await fetch(`${base}/missions/legacy`)).json()) as {
			rows: Record<string, unknown>[];
		};

		expect(body.rows[0]).toHaveProperty("mission_id");
		expect(body.rows[0]).toHaveProperty("mission_state");
	});

	it("serves an avatar as immutable bytes", async () => {
		const response = await fetch(`${base}/crew/c-1/avatar.png`);

		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toContain("immutable");
	});

	it("fails a stated number of times and then works", async () => {
		// A retry policy cannot be exercised against a server that always answers.
		const first = await fetch(`${base}/unstable?run=r1&failures=2`);
		const second = await fetch(`${base}/unstable?run=r1&failures=2`);
		const third = await fetch(`${base}/unstable?run=r1&failures=2`);

		expect([first.status, second.status, third.status]).toEqual([503, 503, 200]);
	});

	it("takes as long as it is asked to, so a deadline has something to cut", async () => {
		const started = Date.now();
		await fetch(`${base}/slow?ms=120`);

		expect(Date.now() - started).toBeGreaterThanOrEqual(100);
	});

	it("names its build, so a returning visitor's caches can be recognised as old", async () => {
		const manifest = await jsonOf<{ version: string }>(
			await fetch(`${base}/build-manifest.json`),
		);

		expect(manifest.version).toMatch(/\d/);
	});

	it("expires a token after its calls are spent, and a refresh brings it back", async () => {
		// The whole point of the session half: a client's refresh-on-401 cannot be
		// exercised against a server whose tokens never expire.
		const short = createAtlasServer({ callsPerToken: 1 });
		const shortBase = await short.listen(0);

		const opened = (await (
			await fetch(`${shortBase}/session`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Ada" }),
			})
		).json()) as { token: string; refreshToken: string };

		const me = (headers: Record<string, string>) => fetch(`${shortBase}/me`, { headers });

		expect((await me({ authorization: `Bearer ${opened.token}` })).status).toBe(200);
		expect((await me({ authorization: `Bearer ${opened.token}` })).status).toBe(401);

		const renewed = (await (
			await fetch(`${shortBase}/session/refresh`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ refreshToken: opened.refreshToken }),
			})
		).json()) as { token: string };

		expect((await me({ authorization: `Bearer ${renewed.token}` })).status).toBe(200);
		await short.close();
	});

	it("refuses a refresh token nobody issued, and invites a sign-in rather than a retry", async () => {
		const response = await fetch(`${base}/session/refresh`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ refreshToken: "atlas-refresh-forged" }),
		});

		expect(response.status).toBe(401);
		expect((await jsonOf<{ code: string }>(response)).code).toBe("REFRESH_REJECTED");
	});

	it("signs in a nameless caller as a guest rather than refusing", async () => {
		const response = await fetch(`${base}/session`, { method: "POST" });

		expect(response.status).toBe(201);
		expect((await jsonOf<{ name: string }>(response)).name).toBe("Guest");
	});

	it("changes a mission, and 404s when there is nothing to change", async () => {
		const headers = await signedIn();

		const changed = await fetch(`${base}/missions/m-3`, {
			method: "PATCH",
			headers,
			body: JSON.stringify({ title: "Repair the relay mast twice" }),
		});
		const missing = await fetch(`${base}/missions/m-nope`, {
			method: "PATCH",
			headers,
			body: JSON.stringify({ title: "Repair the relay mast twice" }),
		});

		expect((await jsonOf<{ title: string }>(changed)).title).toBe(
			"Repair the relay mast twice",
		);
		expect(missing.status).toBe(404);
	});

	it("assigns, completes and removes a mission", async () => {
		const headers = await signedIn();
		const created = (await (
			await fetch(`${base}/missions`, {
				method: "POST",
				headers,
				body: JSON.stringify({ title: "Walk the perimeter" }),
			})
		).json()) as { id: string };

		const assigned = await fetch(`${base}/missions/${created.id}/assign`, {
			method: "POST",
			headers,
			body: JSON.stringify({ crewId: "c-2" }),
		});
		const completed = await fetch(`${base}/missions/${created.id}/complete`, {
			method: "POST",
			headers,
		});
		const removed = await fetch(`${base}/missions/${created.id}`, {
			method: "DELETE",
			headers,
		});

		expect((await jsonOf<{ crewId: string }>(assigned)).crewId).toBe("c-2");
		expect((await jsonOf<{ status: string }>(completed)).status).toBe("done");
		expect(removed.status).toBe(200);
		expect((await fetch(`${base}/missions/${created.id}`)).status).toBe(404);
	});

	it("serves the crew", async () => {
		const crew = (await (await fetch(`${base}/crew`)).json()) as { id: string }[];

		expect(crew.map((member) => member.id)).toContain("c-1");
	});

	it("answers a preflight without routing it", async () => {
		const response = await fetch(`${base}/missions`, { method: "OPTIONS" });

		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-credentials")).toBe("true");
	});

	it("names the headers a browser would otherwise hide from a script", async () => {
		// `grpc-status` is unreadable in a browser unless it is exposed, and the
		// gap makes a gRPC refusal arrive as a schema failure in the browser and
		// nowhere else.
		const exposed = (await fetch(`${base}/missions`)).headers.get(
			"access-control-expose-headers",
		);

		expect(exposed).toContain("grpc-status");
	});
});
