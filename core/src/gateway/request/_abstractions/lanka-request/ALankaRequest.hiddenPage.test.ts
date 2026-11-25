import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LankaFetchJsonRequest } from "../../lanka-fetch-json-request/LankaFetchJsonRequest";
import { LankaError } from "../../../../errors/lanka-error/LankaError";
import { createLanka } from "../../../../bootstrap/_factories/create-lanka/createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaTransport } from "../../../_interfaces/ILankaTransport";

/**
 * A transport failure says whether the page hid during the attempt (#16).
 *
 * On the real path, through `execute`: the flag is worth something only if it is
 * set where the failure is TAGGED, before any middleware reads it.
 */

let visibility: DocumentVisibilityState = "visible";

const setVisibility = (state: DocumentVisibilityState): void => {
	visibility = state;
	document.dispatchEvent(new Event("visibilitychange"));
};

/** Fails after the page did what `during` does to it. */
const transportFailingAfter = (
	during: () => void,
	error: unknown,
): ILankaTransport<RequestInit> => ({
	request: async () => {
		await Promise.resolve();
		during();
		throw error;
	},
});

const failureOf = async (transport: ILankaTransport<RequestInit>): Promise<LankaError> =>
	(await new LankaFetchJsonRequest({ transport })
		.execute("/things")
		.catch((error: unknown) => error)) as LankaError;

beforeEach(() => {
	createLanka({ host: lankaTestHost });
	visibility = "visible";
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		get: () => visibility,
	});
});

afterEach(() => {
	Reflect.deleteProperty(document, "visibilityState");
});

describe("`isFromHiddenPage` on a transport failure", () => {
	it("is set on a dropped connection of an attempt the page hid through", async () => {
		const error = await failureOf(
			transportFailingAfter(() => {
				setVisibility("hidden");
				setVisibility("visible");
			}, new TypeError("Failed to fetch")),
		);

		expect(error.kind).toBe("network");
		expect(error.isFromHiddenPage).toBe(true);
	});

	it("is set on a fetch cut by the page unloading", async () => {
		const error = await failureOf(
			transportFailingAfter(() => {
				window.dispatchEvent(new Event("pagehide"));
			}, new TypeError("Failed to fetch")),
		);

		expect(error.isFromHiddenPage).toBe(true);
	});

	it("is not set when the page stayed visible", async () => {
		const error = await failureOf(
			transportFailingAfter(() => undefined, new TypeError("Failed to fetch")),
		);

		expect(error.kind).toBe("network");
		expect(error.isFromHiddenPage).toBe(false);
	});

	it("is set on a cancellation too, which stays silent", async () => {
		const error = await failureOf(
			transportFailingAfter(
				() => {
					setVisibility("hidden");
				},
				new DOMException("The operation was aborted.", "AbortError"),
			),
		);

		expect(error.kind).toBe("aborted");
		expect(error.isFromHiddenPage).toBe(true);
		expect(error.isSilent).toBe(true);
	});
});
