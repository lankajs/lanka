import { describe, expect, it } from "vitest";
import { forwardLankaHeaders } from "./forwardLankaHeaders";
import type { ILankaRequestContext } from "lanka/gateway";

const through = async (
	middleware: ReturnType<typeof forwardLankaHeaders>,
	options: unknown,
): Promise<unknown> => {
	let sent: unknown;

	await middleware({ endpoint: "/x", options, attempt: 1 }, (ctx: ILankaRequestContext) => {
		sent = ctx.options;
		return Promise.resolve(undefined);
	});

	return sent;
};

describe("putting the caller's identity on the request", () => {
	it("adds the headers a gateway did not set", async () => {
		const sent = await through(forwardLankaHeaders({ cookie: "session=abc" }), {
			method: "GET",
		});

		expect(sent).toEqual({ method: "GET", headers: { cookie: "session=abc" } });
	});

	it("adds them when the gateway passed no options at all", async () => {
		// `execute(endpoint)` is the common case: a gateway that needs nothing of
		// its transport. This is the path that matters most, not an edge.
		expect(await through(forwardLankaHeaders({ cookie: "c" }), undefined)).toEqual({
			headers: { cookie: "c" },
		});
	});

	it("NEVER overwrites a header the gateway set itself", async () => {
		// Whoever wrote the call knew something this does not — a service token, a
		// different tenant, a deliberately anonymous request.
		const sent = await through(forwardLankaHeaders({ authorization: "Bearer forwarded" }), {
			headers: { Authorization: "Bearer explicit" },
		});

		expect(sent).toEqual({ headers: { Authorization: "Bearer explicit" } });
	});

	it("keeps the other options as they were", async () => {
		const sent = await through(forwardLankaHeaders({ cookie: "c" }), {
			method: "POST",
			body: "{}",
		});

		expect(sent).toMatchObject({ method: "POST", body: "{}" });
	});

	it("passes the request through untouched when there is nothing to add", async () => {
		const options = { method: "GET" };

		expect(await through(forwardLankaHeaders({}), options)).toBe(options);
	});

	it("passes through options no transport of ours would recognise", async () => {
		// `options` is `unknown` by contract: every transport has its own. A shape
		// this cannot read is not a failure, it is somebody else's transport.
		expect(await through(forwardLankaHeaders({ cookie: "c" }), "not an object")).toBe(
			"not an object",
		);
	});
});
