import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { LankaFetchJsonRequest, type ILankaTransport } from "lanka/gateway";
import { LankaError } from "lanka/errors";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaHttp } from "../../index";
import { lankaFirstOf } from "../lanka-first-of/lankaFirstOf";
import { lankaMessageFromErrorList } from "../lanka-message-from-error-list/lankaMessageFromErrorList";
import { lankaMessageFromFieldErrors } from "../lanka-message-from-field-errors/lankaMessageFromFieldErrors";

/**
 * Two backends' error contracts in one place.
 *
 * Two applications can need genuinely different error handling. What is pinned
 * here is that both policies are assembled from ONE body of code with different
 * configuration: if the plugin named a consumer, the work would not be done —
 * the fork would simply have moved to another file.
 */

const failingTransport = (status: number, body: string, contentType = "application/json") => {
	const transport: ILankaTransport<RequestInit> = {
		request: () =>
			Promise.resolve(
				new Response(body, { status, headers: { "content-type": contentType } }),
			),
	};
	return transport;
};

const request = (transport: ILankaTransport<RequestInit>) =>
	new LankaFetchJsonRequest({ transport }).execute("/api/things", { method: "POST" });

const failureOf = async (transport: ILankaTransport<RequestInit>): Promise<LankaError> => {
	try {
		await request(transport);
	} catch (error) {
		if (LankaError.is(error)) return error;
		throw error;
	}
	throw new Error("the request did not fail");
};

describe("@lankajs/plugin-http — parsing a server failure", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("two different policies produce one shape with different codes", async () => {
		// One backend sends `{ errorCode, message }`, another `{ error, message }`.
		// The difference is extractor configuration, not a branch in the plugin.
		lanka.use(lankaHttp({ errors: {} }));

		const underErrorCode = await failureOf(
			failingTransport(409, JSON.stringify({ errorCode: "ALREADY_CLAIMED" })),
		);
		expect(underErrorCode.kind).toBe("http");
		expect(underErrorCode.status).toBe(409);
		expect(underErrorCode.code).toBe("ALREADY_CLAIMED");

		const underError = await failureOf(
			failingTransport(403, JSON.stringify({ error: "NOT_AUTHORIZED" })),
		);
		expect(underError.kind).toBe("http");
		expect(underError.status).toBe(403);
		expect(underError.code).toBe("NOT_AUTHORIZED");
	});

	it("an unparsed body yields `http` with the host's text, not `schema`", async () => {
		// The distinction matters: `schema` means a broken response contract and
		// retrying is pointless. An ERROR body that was not parsed is not a broken
		// contract — the server refused deliberately.
		lanka.use(lankaHttp({ errors: {} }));

		const failure = await failureOf(
			failingTransport(502, "<html>Bad Gateway</html>", "text/html"),
		);

		expect(failure.kind).toBe("http");
		expect(failure.status).toBe(502);
		expect(failure.code).toBeUndefined();
	});

	it("the message comes from the application's extractor", async () => {
		lanka.use(lankaHttp({ errors: { extractMessage: lankaMessageFromFieldErrors } }));

		const failure = await failureOf(
			failingTransport(422, JSON.stringify({ errors: { email: ["Invalid address"] } })),
		);

		expect(failure.message).toBe("Invalid address");
		expect(failure.errors).toEqual(["Invalid address"]);
	});

	it("several shapes are tried in the given order", async () => {
		// The application sets the order: it has one backend and knows its shape.
		// Trying "everything known" is guessing, which is why parsing left core.
		lanka.use(
			lankaHttp({
				errors: {
					extractMessage: lankaFirstOf(
						lankaMessageFromFieldErrors,
						lankaMessageFromErrorList,
					),
				},
			}),
		);

		const failure = await failureOf(
			failingTransport(400, JSON.stringify({ errors: [{ message: "Bad request" }] })),
		);

		expect(failure.message).toBe("Bad request");
	});

	it("notifies on every failure — where an application hangs its analytics", async () => {
		// One application reports every failure to analytics, another reports
		// nothing. The difference is configuration, not a branch.
		const onRequestFailed = vi.fn();
		lanka.use(lankaHttp({ errors: { onRequestFailed } }));

		await failureOf(failingTransport(500, JSON.stringify({ errorCode: "BOOM" })));

		expect(onRequestFailed).toHaveBeenCalledWith({
			status: 500,
			code: "BOOM",
			endpoint: "/api/things",
		});
	});

	it("a throwing notification does not replace the server error", async () => {
		// Otherwise the user would see the failure of the failure REPORT, and the
		// original cause would vanish with it.
		lanka.use(
			lankaHttp({
				errors: {
					onRequestFailed: () => {
						throw new Error("analytics unavailable");
					},
				},
			}),
		);

		const failure = await failureOf(
			failingTransport(500, JSON.stringify({ errorCode: "BOOM" })),
		);

		expect(failure.code).toBe("BOOM");
		expect(failure.status).toBe(500);
	});

	it("leaves alone errors that are not server failures", async () => {
		// A network failure is already named by kind, and rewriting it here would
		// take from the caller the one thing the kind exists for.
		lanka.use(lankaHttp({ errors: {} }));
		const transport: ILankaTransport<RequestInit> = {
			request: () => Promise.reject(new TypeError("Failed to fetch")),
		};

		const failure = await failureOf(transport);

		expect(failure.kind).toBe("network");
	});

	it("the body reaches the plugin even though a `Response` is read once", async () => {
		// A handler placed second would get a drained stream and an empty body —
		// silently. That is why the body travels with the error.
		lanka.use(lankaHttp({ errors: {} }));

		const failure = await failureOf(
			failingTransport(400, JSON.stringify({ errorCode: "X", extra: 1 })),
		);

		expect(failure.body).toEqual({ errorCode: "X", extra: 1 });
	});
});
