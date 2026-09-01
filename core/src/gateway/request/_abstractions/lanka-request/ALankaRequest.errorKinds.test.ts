import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaFetchJsonRequest } from "../../lanka-fetch-json-request/LankaFetchJsonRequest";
import { LankaError } from "../../../../errors/lanka-error/LankaError";
import { handleLankaApiError } from "../../../../errors/handle-lanka-api-error/handleLankaApiError";
import { createLanka } from "../../../../bootstrap/_factories/create-lanka/createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaTransport } from "../../../_interfaces/ILankaTransport";

/**
 * Every way of failing names itself.
 *
 * ## Why this is checked on the real path rather than on the constructor
 *
 * That `LankaError` can carry a kind is proved in `errors/LankaError.test.ts`.
 * Until the kind is ASSIGNED where the failure is born, unnamed `Error`s still
 * reach the application and it has to parse strings again.
 *
 * Hence four checks: network, schema, HTTP, cancellation — one per kind that can
 * be born in a transport.
 */

/**
 * A transport that fails.
 *
 * `throw` inside `async` rather than `Promise.reject`: the lint rule requires a
 * rejection reason to be an `Error`, and here the reason is sometimes a
 * `DOMException` — exactly what a real cancellation produces.
 */
const transportThatThrows = (error: unknown): ILankaTransport<RequestInit> => ({
	request: async () => {
		await Promise.resolve();
		throw error;
	},
});

const transportThatAnswers = (body: string, init?: ResponseInit): ILankaTransport<RequestInit> => ({
	request: () => Promise.resolve(new Response(body, init)),
});

describe("the failure kind is assigned where the failure is born", () => {
	beforeEach(() => {
		createLanka({ host: lankaTestHost });
	});

	it("a dropped connection yields kind: network, keeping the original error as cause", async () => {
		// How a real `fetch` fails: not a Response with a status but a thrown TypeError.
		const cause = new TypeError("Failed to fetch");
		const request = new LankaFetchJsonRequest({ transport: transportThatThrows(cause) });

		const error = await request.execute("/things").catch((e: unknown) => e);

		expect(error).toBeInstanceOf(LankaError);
		expect((error as LankaError).kind).toBe("network");
		expect((error as LankaError).cause).toBe(cause);
	});

	it("a cancelled request yields kind: aborted and stays silent", async () => {
		const abort = new DOMException("The operation was aborted.", "AbortError");
		const request = new LankaFetchJsonRequest({ transport: transportThatThrows(abort) });

		const error = (await request.execute("/things").catch((e: unknown) => e)) as LankaError;

		expect(error.kind).toBe("aborted");
		// Nothing to show: the user left before the response, and a toast would
		// catch them on another screen.
		expect(error.isSilent).toBe(true);
	});

	it("a wrong-shaped response yields kind: schema, not network", async () => {
		// A dev server answering /api with index.html and status 200 is NOT a
		// network failure — it is a broken contract.
		const request = new LankaFetchJsonRequest({
			transport: transportThatAnswers("<!doctype html><html></html>", {
				headers: { "content-type": "text/html" },
			}),
		});

		const error = (await request.execute("/things").catch((e: unknown) => e)) as LankaError;

		expect(error.kind).toBe("schema");
		expect(error.message).toContain("text/html");
	});

	it("a server error status yields kind: http with the status and the server's message", async () => {
		const request = new LankaFetchJsonRequest({
			transport: transportThatAnswers(JSON.stringify({ message: "Slot taken" }), {
				status: 409,
			}),
			// How a gateway is wired: parsing the body is the handler's job, and
			// `ALankaGateway` supplies `handleLankaApiError` by default.
			errorHandler: handleLankaApiError,
		});

		const error = (await request.execute("/things").catch((e: unknown) => e)) as LankaError;

		expect(error.kind).toBe("http");
		expect(error.status).toBe(409);
		expect(error.message).toBe("Slot taken");
	});

	it("without a handler the kind is still http, not network", async () => {
		// Nobody parsed the body, but one thing is certain: the server answered,
		// and answered with an error status. Tagging that `network` would invite a
		// retry of a request that already got a meaningful answer.
		const request = new LankaFetchJsonRequest({
			transport: transportThatAnswers("", { status: 500 }),
		});

		const error = (await request.execute("/things").catch((e: unknown) => e)) as LankaError;

		expect(error.kind).toBe("http");
		expect(error.status).toBe(500);
	});

	it("an already-tagged error is not re-tagged", async () => {
		// Otherwise the layer above would lose the kind: a request-policy plugin
		// reports `domain` and the transport would rewrite it to `network`.
		const domain = new LankaError({
			kind: "domain",
			message: "slot taken",
			code: "GAP_TAKEN",
		});
		const request = new LankaFetchJsonRequest({ transport: transportThatThrows(domain) });

		const error = (await request.execute("/things").catch((e: unknown) => e)) as LankaError;

		expect(error.kind).toBe("domain");
		expect(error.code).toBe("GAP_TAKEN");
	});

	it("the in-flight counter returns to zero after a failure", async () => {
		const lanka = createLanka({ host: lankaTestHost });
		const request = new LankaFetchJsonRequest({
			transport: transportThatThrows(new TypeError("Failed to fetch")),
		});

		await request.execute("/things").catch(() => undefined);

		// Tagging happens in the same `execute` that keeps the count. A catch
		// placed outside the `finally` would leave a permanent +1 and disable
		// prefetch for the rest of the session.
		expect(lanka.inFlight.getActiveCount()).toBe(0);
	});
});

describe("transport with a mock", () => {
	it("mock mode does not go through failure classification", async () => {
		createLanka({ host: lankaTestHost, flags: { isMockMode: true } });
		const request = new LankaFetchJsonRequest({
			transport: transportThatThrows(
				new TypeError("the network should not have been needed"),
			),
			useMock: true,
		});

		const result = await request.execute("/things", undefined, () =>
			Promise.resolve({ id: 1 }),
		);

		expect(result).toEqual({ id: 1 });
		expect(vi.isMockFunction(request.execute)).toBe(false);
	});
});

describe("tagging a cancellation does not depend on the error extending Error", () => {
	it("a `DOMException` named AbortError counts as a cancellation", async () => {
		// `DOMException` — how `fetch` reports cancellation — does not extend
		// `Error` everywhere: in a browser yes, in jsdom no. An `instanceof Error`
		// check lets cancellation past the tagging, and a raw `AbortError` reaches
		// the app with no `kind` and no `status`: retry policy reads it as
		// non-retryable, the app as an unknown error, and the user sees a failure
		// instead of the silence a cancellation deserves.
		const request = new LankaFetchJsonRequest({
			transport: {
				request: () => Promise.reject(new DOMException("aborted", "AbortError")),
			},
		});

		await expect(request.execute("/api/things")).rejects.toMatchObject({
			kind: "aborted",
			name: "LankaError",
		});
	});

	it("an object without an Error prototype but named TimeoutError is a timeout", async () => {
		const request = new LankaFetchJsonRequest({
			transport: {
				request: () =>
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a non-Error is exactly what is under test
					Promise.reject({ name: "TimeoutError", message: "expired" }),
			},
		});

		await expect(request.execute("/api/things")).rejects.toMatchObject({ kind: "timeout" });
	});
});
