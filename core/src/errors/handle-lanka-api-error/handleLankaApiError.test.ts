import { beforeEach, describe, expect, it } from "vitest";
import { createLanka } from "../../bootstrap/_factories/create-lanka/createLanka";
import { resetActiveLanka } from "../../bootstrap/reset-active-lanka/resetActiveLanka";
import { createLankaApiError } from "../_factories/create-lanka-api-error/createLankaApiError";
import { handleLankaApiError } from "./handleLankaApiError";

/**
 * The framework does not phrase HTTP errors — the host does.
 *
 * This used to assert `"http.notFound"`, the bare i18n key one particular
 * consumer returns when its locales are not loaded. That was an assertion
 * about that app, made from inside the framework, and it stopped compiling
 * the moment the layer became a package with no i18n of its own.
 *
 * The behaviour worth pinning is the DELEGATION: an empty body falls back to
 * whatever `host.httpErrorMessage(status)` returns, verbatim, with the real
 * status handed to it.
 */
const seenStatuses: number[] = [];

beforeEach(() => {
	seenStatuses.length = 0;
	resetActiveLanka();
	createLanka({
		host: {
			apiBaseUrl: "https://api.test",
			httpErrorMessage: (status: number) => {
				seenStatuses.push(status);
				return `host copy for ${status}`;
			},
			networkErrorMessage: () => "network",
			timeoutErrorMessage: () => "timeout",
		},
	}).activate();
});

const expectApiError = async (
	response: Response,
	expectedStatus: number,
	expectedErrors: string[],
	expectedMessage?: string,
) => {
	try {
		await handleLankaApiError(response);
		throw new Error("Expected handleLankaApiError to throw");
	} catch (err) {
		const error = err as Error & {
			status?: number;
			errors?: string[];
		};
		expect(error.status).toBe(expectedStatus);
		expect(error.errors).toEqual(expectedErrors);
		expect(error.message).toBe(expectedMessage ?? expectedErrors[0]);
	}
};

describe("ApiErrorHandler", () => {
	it("createLankaApiError sets status, errors, and message", () => {
		const err = createLankaApiError(400, ["Bad input"]);
		expect(err.status).toBe(400);
		expect(err.errors).toEqual(["Bad input"]);
		expect(err.message).toBe("Bad input");
	});

	it("takes `message` as a string — the only shape core knows", async () => {
		await expectApiError(
			new Response(JSON.stringify({ message: "Boom" }), { status: 500 }),
			500,
			["Boom"],
		);
	});

	it("attaches the parsed body to the error", async () => {
		// This field is what let parsing leave core: a `Response` is read once, and
		// a plugin extracting the domain code would read a drained stream.
		try {
			await handleLankaApiError(
				new Response(JSON.stringify({ errorCode: "GAP_LOCKED", extra: 1 }), {
					status: 409,
				}),
			);
			throw new Error("Expected handleLankaApiError to throw");
		} catch (err) {
			expect((err as { body?: unknown }).body).toEqual({ errorCode: "GAP_LOCKED", extra: 1 });
		}
	});

	it("does NOT parse backend shapes — that is the plugin's job", async () => {
		// Nested `errors: { field: [...] }`, object arrays, `detail`, concatenating
		// every value of the body — parsing that knows several applications'
		// contracts and therefore none of them. It lives in `@lankajs/plugin-http`,
		// where it is configurable; what remains here is the host's text.
		await expectApiError(
			new Response(JSON.stringify({ errors: { field: ["Invalid"] } }), { status: 422 }),
			422,
			["host copy for 422"],
		);
	});

	it("a non-JSON body becomes the message", async () => {
		// The only description of the failure there is. Discarding it for having the
		// wrong shape leaves no reason at all.
		await expectApiError(new Response("Gateway timeout", { status: 504 }), 504, [
			"Gateway timeout",
		]);
	});

	it("long foreign text is truncated", async () => {
		// Two hundred characters is where foreign text in a message stops helping
		// and starts getting in the way of reading it.
		const long = "x".repeat(500);
		try {
			await handleLankaApiError(new Response(long, { status: 500 }));
			throw new Error("Expected handleLankaApiError to throw");
		} catch (err) {
			expect((err as Error).message).toHaveLength(200);
		}
	});

	it("asks the host for the message when the body is empty", async () => {
		await expectApiError(new Response(null, { status: 404 }), 404, ["host copy for 404"]);
		expect(seenStatuses).toContain(404);
	});

	it("an empty body produces no `body`", async () => {
		try {
			await handleLankaApiError(new Response(null, { status: 404 }));
			throw new Error("Expected handleLankaApiError to throw");
		} catch (err) {
			expect((err as { body?: unknown }).body).toBeUndefined();
		}
	});

	it("the kind is always `http`, even when the body is unparsed", async () => {
		// `schema` would mean a broken response contract: pointless to retry and
		// nothing to show. An ERROR body that was not parsed is not the same: the
		// server refused deliberately.
		try {
			await handleLankaApiError(new Response("<html>502</html>", { status: 502 }));
			throw new Error("Expected handleLankaApiError to throw");
		} catch (err) {
			expect((err as { kind?: string }).kind).toBe("http");
		}
	});

	it("stress: repeated handleLankaApiError calls (timing)", async () => {
		const iterations = 100;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		let caught = 0;
		const start = now();
		for (let i = 0; i < iterations; i += 1) {
			const response = new Response(JSON.stringify({ errors: ["Boom"] }), {
				status: 400,
				headers: {
					"content-type": "application/json",
				},
			});

			try {
				await handleLankaApiError(response);
			} catch {
				caught += 1;
			}
		}
		const durationMs = now() - start;

		console.info(`ApiErrorHandler stress duration: ${durationMs.toFixed(2)}ms`);
		expect(caught).toBe(iterations);
	});
});
