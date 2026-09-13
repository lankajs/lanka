// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { runLankaRequest } from "@lankajs/host/server";
import { createLankaVM } from "lanka/viewmodel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AtlasSessionGateway } from "@lanka-playgrounds/_shared";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * Two people, one process, at the same moment.
 *
 * A browser has one user and one instance, so nothing there can tell a
 * per-request seam from a global one — both work. A server is where the two stop
 * agreeing: `runLankaRequest` makes an instance per request, and everything
 * ABOVE it is still a module-level singleton shared by every request in flight.
 *
 * What this file asks is the question a consumer's security review asks: can
 * request B end up reading with request A's identity? Nothing in a unit test can
 * answer it — it needs two real scopes, two real tokens and a server that
 * actually checks them.
 *
 * Node rather than jsdom, for the reason `atlas.live.test.ts` states at length:
 * under jsdom every real request fails on a cross-realm `AbortSignal`.
 */
let api: IAtlasServer;
let base: string;

/** Signs somebody in OUTSIDE any request scope, and hands back their token. */
const tokenFor = async (name: string): Promise<string> => {
	const response = await fetch(`${base}/session`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ name }),
	});

	return ((await response.json()) as { token: string }).token;
};

/**
 * A ViewModel declared at MODULE level, which is what a screen file does.
 *
 * This is the whole point of the file. It is built once per PROCESS, and its
 * gateways are resolved once — inside zustand's state creator, on whichever
 * request happened to touch it first. Every later request reuses that store.
 */
const useWhoAmIVM = createLankaVM<
	{ seen: string | null },
	{ read: () => Promise<void> },
	{ session: AtlasSessionGateway }
>({
	name: "WhoAmIVM",
	states: { seen: null },
	gateways: () => ({ session: new AtlasSessionGateway() }),
	createActions: ({ set, gateways }) => ({
		read: async () => {
			const me = await gateways.session.whoAmI();
			set({ seen: me.name });
		},
	}),
});

beforeAll(async () => {
	// Generous, because this file spends tokens on `/me` and a token that expired
	// mid-test would look exactly like the leak being hunted.
	api = createAtlasServer({ callsPerToken: 200 });
	base = await api.listen(0);
});

afterAll(async () => {
	await api.close();
});

describe("two requests in one process", () => {
	it("gives each request the identity it arrived with, one after another", async () => {
		const [ada, grace] = await Promise.all([tokenFor("Ada"), tokenFor("Grace")]);

		const read = (token: string) =>
			runLankaRequest(
				{ apiBaseUrl: base, headers: { authorization: `Bearer ${token}` } },
				async () => {
					const gateway = new AtlasSessionGateway();

					return (await gateway.whoAmI()).name;
				},
			);

		// Sequential first: if even THIS crosses over, the seam is not per-request
		// at all and the concurrent case below would be the wrong thing to blame.
		expect(await read(ada)).toBe("Ada");
		expect(await read(grace)).toBe("Grace");
	});

	it("keeps two identities apart when the requests overlap", async () => {
		const [ada, grace] = await Promise.all([tokenFor("Ada"), tokenFor("Grace")]);

		let releaseAda: () => void = () => undefined;
		const adaIsInside = new Promise<void>((resolve) => {
			releaseAda = resolve;
		});

		// Ada enters her scope and WAITS there, so Grace's scope is opened while
		// Ada's is still on the stack. Sequential scopes would pass under a plain
		// module-level global; only an overlap can tell the two apart.
		const adaReads = runLankaRequest(
			{ apiBaseUrl: base, headers: { authorization: `Bearer ${ada}` } },
			async () => {
				const gateway = new AtlasSessionGateway();
				await adaIsInside;

				return (await gateway.whoAmI()).name;
			},
		);

		const graceReads = runLankaRequest(
			{ apiBaseUrl: base, headers: { authorization: `Bearer ${grace}` } },
			async () => {
				const gateway = new AtlasSessionGateway();
				const name = (await gateway.whoAmI()).name;
				releaseAda();

				return name;
			},
		);

		expect(await Promise.all([adaReads, graceReads])).toEqual(["Ada", "Grace"]);
	});

	it("does not serve the second request through the first one's gateways", async () => {
		// The one a screen actually hits. A module-level ViewModel resolves its
		// gateways ONCE — zustand builds the store on first read — so the second
		// request through the same VM is reading through an object that was built
		// inside somebody else's scope.
		const [ada, grace] = await Promise.all([tokenFor("Ada"), tokenFor("Grace")]);

		const readThroughVM = (token: string) =>
			runLankaRequest(
				{ apiBaseUrl: base, headers: { authorization: `Bearer ${token}` } },
				async () => {
					await useWhoAmIVM.getState().read();

					return useWhoAmIVM.getState().seen;
				},
			);

		expect(await readThroughVM(ada)).toBe("Ada");
		expect(await readThroughVM(grace)).toBe("Grace");
	});
});
