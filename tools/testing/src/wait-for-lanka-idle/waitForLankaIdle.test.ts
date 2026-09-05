import { beforeEach, describe, expect, it } from "vitest";
import { resetLanka } from "../resetLanka";
import { waitForLankaIdle } from "./waitForLankaIdle";
import type { ILankaInstance } from "lanka/bootstrap";

/**
 * The helper replaces `await new Promise((r) => setTimeout(r, 0))`, so the cases
 * are the ways that line is wrong: it does not wait for the wire, it drains one
 * turn rather than the chain, and it never fails when the work never finishes.
 */
let lanka: ILankaInstance;

beforeEach(() => {
	lanka = resetLanka();
});

describe("waitForLankaIdle", () => {
	it("returns straight away when the wire is already clear", async () => {
		await expect(waitForLankaIdle({ lanka })).resolves.toBeUndefined();
	});

	it("waits for a request that is on the wire", async () => {
		lanka.inFlight.begin();
		let cleared = false;

		setTimeout(() => {
			cleared = true;
			lanka.inFlight.end();
		}, 5);
		await waitForLankaIdle({ lanka });

		expect(cleared).toBe(true);
		expect(lanka.inFlight.getActiveCount()).toBe(0);
	});

	it("drains the chain the request started, not one turn of it", async () => {
		// The defect this replaces: a single `setTimeout(0)` returns while the
		// gateway's `.then` has resolved and the ViewModel's `set` has not run.
		const order: string[] = [];

		lanka.inFlight.begin();
		void Promise.resolve()
			.then(() => {
				lanka.inFlight.end();
			})
			.then(() => order.push("gateway resolved"))
			.then(() => order.push("state set"));

		await waitForLankaIdle({ lanka });

		expect(order).toEqual(["gateway resolved", "state set"]);
	});

	it("rejects on its deadline, naming what is still outstanding", async () => {
		// "Timed out" with no subject sends the reader to the wrong half of the
		// application.
		lanka.inFlight.begin();

		await expect(waitForLankaIdle({ lanka, timeoutMs: 10 })).rejects.toThrow(
			/1 request\(s\) are still in flight/,
		);
		lanka.inFlight.end();
	});

	it("waits for a request that has not started yet", async () => {
		// An action that has not been awaited has not reached the transport, so the
		// counter reads zero and the wire LOOKS clear while the request is one
		// microtask away.
		let finished = false;
		void Promise.resolve().then(() => {
			lanka.inFlight.begin();
			setTimeout(() => {
				finished = true;
				lanka.inFlight.end();
			}, 5);
		});

		await waitForLankaIdle({ lanka });

		expect(finished).toBe(true);
	});

	it("falls back to the active instance when it is given none", async () => {
		await expect(waitForLankaIdle()).resolves.toBeUndefined();
	});
});
