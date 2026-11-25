import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "./createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";

/**
 * A start-up service's deadline stops while the app is in the background.
 *
 * The user opens the app, leaves it while it is still starting — an external
 * link, an app switch — and the WebView is frozen. A plain timer fired on
 * resume, and a REQUIRED service "too slow" while the app was merely frozen
 * failed the whole boot: the user came back to an app that never started.
 */

let visibility: DocumentVisibilityState = "visible";

const setVisibility = (state: DocumentVisibilityState): void => {
	visibility = state;
	document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
	visibility = "visible";
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		get: () => visibility,
	});
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	Reflect.deleteProperty(document, "visibilityState");
});

describe("a start-up service in the background", () => {
	it("a required service is not failed by a minute the app spent frozen", async () => {
		let finish: () => void = () => undefined;
		const lanka = createLanka({ host: lankaTestHost });
		const boot = lanka.bootstrap({
			services: [
				{
					name: "Session",
					sync: true,
					timeoutMs: 1_000,
					init: () =>
						new Promise<void>((resolve) => {
							finish = resolve;
						}),
				},
			],
		});

		await vi.advanceTimersByTimeAsync(500);
		setVisibility("hidden");
		await vi.advanceTimersByTimeAsync(60_000);
		setVisibility("visible");
		finish();

		await expect(boot).resolves.toBeUndefined();
		expect(lanka.isBootstrapped()).toBe(true);
	});

	it("still fails the plan when the service overruns while the app is visible", async () => {
		const lanka = createLanka({ host: lankaTestHost });
		const boot = lanka.bootstrap({
			services: [
				{
					name: "Session",
					sync: true,
					timeoutMs: 1_000,
					init: () => new Promise<void>(() => undefined),
				},
			],
		});
		const outcome = boot.catch((error: unknown) => error);

		await vi.advanceTimersByTimeAsync(1_000);

		expect(await outcome).toBeInstanceOf(Error);
	});
});
