import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { ALankaGraphqlGateway } from "./ALankaGraphqlGateway";
import { createLankaGraphqlGateway } from "../../_factories/create-lanka-graphql-gateway/createLankaGraphqlGateway";
import { createLankaGraphqlRequest } from "../../_factories/create-lanka-graphql-request/createLankaGraphqlRequest";

/**
 * The gateway, at the request it builds.
 *
 * The playground proves an operation works end to end. What is pinned here is
 * what a caller can quietly break — the content type, and where the endpoint
 * comes from — plus the fact that the two styles build the same POST.
 */

const TODOS = `query Todos { todos { id } }`;
const COMPLETE = `mutation Complete($id: ID!) { completeTodo(id: $id) { id } }`;

const recordingTransport = () => {
	const seen: { resource: string; options: RequestInit }[] = [];

	return {
		seen,
		transport: {
			request: (resource: RequestInfo, options?: RequestInit) => {
				seen.push({ resource: String(resource), options: options ?? {} });
				return Promise.resolve(
					new Response(JSON.stringify({ data: { ok: true } }), {
						headers: { "content-type": "application/json" },
					}),
				);
			},
		},
	};
};

class TestGateway extends ALankaGraphqlGateway {
	public list(options?: Parameters<TestGateway["query"]>[1]) {
		return this.query<{ ok: boolean }>({ document: TODOS }, options);
	}

	public complete(id: string) {
		return this.mutate<{ ok: boolean }>({ document: COMPLETE, variables: { id } });
	}
}

beforeEach(() => {
	createLanka({ host: { ...lankaTestHost, apiBaseUrl: "https://api.test" } });
});

describe("ALankaGraphqlGateway", () => {
	it("posts to `/graphql` under the API base", async () => {
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGraphqlRequest({ transport: wire.transport }),
		});

		await gateway.list();

		expect(wire.seen[0]?.resource).toBe("https://api.test/graphql");
		expect(wire.seen[0]?.options.method).toBe("POST");
	});

	it("takes an endpoint the deployment put elsewhere", async () => {
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGraphqlRequest({ transport: wire.transport }),
			basePath: "/api/graphql",
		});

		await gateway.list();

		expect(wire.seen[0]?.resource).toBe("https://api.test/api/graphql");
	});

	it("sends the JSON content type and an accept a GraphQL server understands", async () => {
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGraphqlRequest({ transport: wire.transport }),
		});

		await gateway.list();

		const headers = wire.seen[0]?.options.headers as Record<string, string>;
		expect(headers["content-type"]).toBe("application/json");
		expect(headers.accept).toContain("application/graphql-response+json");
	});

	it("merges a caller's header instead of dropping its own", async () => {
		// Replaced, the content type would be gone and the server would answer a
		// 400 about a body it never tried to parse.
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGraphqlRequest({ transport: wire.transport }),
		});

		await gateway.list({ headers: { authorization: "Bearer t" } });

		const headers = wire.seen[0]?.options.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer t");
		expect(headers["content-type"]).toBe("application/json");
	});

	it("sends a mutation as the same POST, under its own name", async () => {
		// On the wire they are identical. The name is the only place a GraphQL call
		// says whether it changes anything.
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGraphqlRequest({ transport: wire.transport }),
		});

		await gateway.complete("7");

		const body = JSON.parse(String(wire.seen[0]?.options.body)) as {
			query: string;
			variables: unknown;
		};
		expect(wire.seen[0]?.options.method).toBe("POST");
		expect(body.query).toBe(COMPLETE);
		expect(body.variables).toEqual({ id: "7" });
	});

	it("carries an operation name when the document holds several", async () => {
		const wire = recordingTransport();
		const gateway = createLankaGraphqlGateway({
			request: createLankaGraphqlRequest({ transport: wire.transport }),
			methods: ({ query }) => ({
				list: () => query({ document: TODOS, operationName: "Todos" }),
			}),
		});

		await gateway.list();

		expect(JSON.parse(String(wire.seen[0]?.options.body))).toMatchObject({
			operationName: "Todos",
		});
	});
});

describe("either style builds the same POST", () => {
	it("down to the body and the headers", async () => {
		const asClassWire = recordingTransport();
		const byCallingWire = recordingTransport();
		const asClass = new TestGateway({
			request: createLankaGraphqlRequest({ transport: asClassWire.transport }),
		});
		const byCalling = createLankaGraphqlGateway({
			request: createLankaGraphqlRequest({ transport: byCallingWire.transport }),
			methods: ({ mutate }) => ({
				complete: (id: string) => mutate({ document: COMPLETE, variables: { id } }),
			}),
		});

		await asClass.complete("7");
		await byCalling.complete("7");

		expect(byCallingWire.seen[0]?.options.body).toBe(asClassWire.seen[0]?.options.body);
		expect(byCallingWire.seen[0]?.options.headers).toEqual(
			asClassWire.seen[0]?.options.headers,
		);
	});
});

describe("a gateway built with nothing said", () => {
	it("posts JSON to `/graphql` through the platform's own fetch", async () => {
		// The GUIDE's first example passes no request and no transport, and until
		// this scene nothing proved the two defaults even construct.
		const fetched: { url: string; init: RequestInit }[] = [];
		vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
			fetched.push({ url, init });
			return Promise.resolve(
				new Response(JSON.stringify({ data: { ok: true } }), {
					headers: { "content-type": "application/json" },
				}),
			);
		});

		try {
			await expect(new TestGateway().list()).resolves.toEqual({ ok: true });

			expect(fetched[0]?.url).toBe("https://api.test/graphql");
			expect(fetched[0]?.init.method).toBe("POST");
			expect(JSON.parse(String(fetched[0]?.init.body))).toMatchObject({ query: TODOS });
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
