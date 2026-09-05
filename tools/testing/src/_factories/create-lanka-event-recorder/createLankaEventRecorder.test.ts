import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetLanka } from "../../resetLanka";
import { createLankaEventRecorder } from "./createLankaEventRecorder";
import type { ILankaInstance } from "lanka/bootstrap";

/**
 * What the recorder must be true of, stated as the defects it prevents.
 *
 * The one that matters most is the last group: a wait that gives up quietly, or
 * one that hangs because the event already happened, both produce a suite whose
 * result has nothing to do with the code under test.
 */
let lanka: ILankaInstance;

beforeEach(() => {
	lanka = resetLanka();
});

describe("createLankaEventRecorder", () => {
	it("records every event that crosses the bus", () => {
		const events = createLankaEventRecorder({ lanka });

		lanka.eventBus.dispatch("cart:changed", { items: 1 });
		lanka.eventBus.dispatch("cart:cleared");

		expect(events.all.map((event) => event.eventType)).toEqual([
			"cart:changed",
			"cart:cleared",
		]);
		events.stop();
	});

	it("answers the payloads of one type, in order", () => {
		const events = createLankaEventRecorder({ lanka });

		lanka.eventBus.dispatch("cart:changed", { items: 1 });
		lanka.eventBus.dispatch("other:thing", { items: 99 });
		lanka.eventBus.dispatch("cart:changed", { items: 2 });

		expect(events.of<{ items: number }>("cart:changed")).toEqual([{ items: 1 }, { items: 2 }]);
		expect(events.count("cart:changed")).toBe(2);
		events.stop();
	});

	it("dates each event with the clock it was given", () => {
		// Injected rather than real: an assertion about a timestamp taken from
		// `Date.now()` is an assertion about how long the test took to run.
		const events = createLankaEventRecorder({ lanka, clock: () => 42 });

		lanka.eventBus.dispatch("cart:changed");

		expect(events.all[0].at).toBe(42);
		events.stop();
	});

	it("observes without deciding: a watched event is still delivered", () => {
		// A recorder able to stop delivery would make watching a test change what
		// the test is watching.
		const events = createLankaEventRecorder({ lanka });
		const heard = vi.fn();
		lanka.eventBus.subscribe("cart:changed", heard);

		lanka.eventBus.dispatch("cart:changed", { items: 1 });

		expect(heard).toHaveBeenCalledWith({ items: 1 });
		events.stop();
	});

	it("stops recording once it is stopped", () => {
		const events = createLankaEventRecorder({ lanka });

		lanka.eventBus.dispatch("cart:changed");
		events.stop();
		lanka.eventBus.dispatch("cart:changed");

		// Not "the array is empty": the point is that the SECOND dispatch did not
		// reach it, which an empty array could never distinguish from never having
		// recorded at all.
		expect(events.count("cart:changed")).toBe(1);
	});

	it("keeps recording after it is cleared", () => {
		const events = createLankaEventRecorder({ lanka });

		lanka.eventBus.dispatch("cart:changed");
		events.clear();
		lanka.eventBus.dispatch("cart:changed");

		expect(events.count("cart:changed")).toBe(1);
		events.stop();
	});

	it("watches the ACTIVE instance when it is given none", () => {
		// The common call: a test that let the setup file make the instance has no
		// handle on it, and asking for one to record events would be a preamble the
		// kit exists to remove.
		const events = createLankaEventRecorder();

		lanka.eventBus.dispatch("cart:changed");

		expect(events.count("cart:changed")).toBe(1);
		events.stop();
	});
});

describe("createLankaEventRecorder — waiting", () => {
	it("resolves with the event that has not happened yet", async () => {
		const events = createLankaEventRecorder({ lanka });
		const waited = events.waitFor<{ items: number }>("cart:changed");

		lanka.eventBus.dispatch("cart:changed", { items: 7 });

		await expect(waited).resolves.toEqual({ items: 7 });
		events.stop();
	});

	it("is not woken by a different event crossing first", async () => {
		// A wait that resolved on the next event of ANY type would answer with a
		// payload belonging to something else, and the assertion after it would be
		// about the wrong subject.
		const events = createLankaEventRecorder({ lanka });
		const waited = events.waitFor<{ items: number }>("cart:changed");

		lanka.eventBus.dispatch("other:thing", { items: 99 });
		lanka.eventBus.dispatch("cart:changed", { items: 7 });

		await expect(waited).resolves.toEqual({ items: 7 });
		events.stop();
	});

	it("resolves immediately for one that already happened", async () => {
		// Waiting for something that has already happened is the classic race: a
		// helper that only listened forward would hang, and the test would fail by
		// timing rather than by behaviour.
		const events = createLankaEventRecorder({ lanka });
		lanka.eventBus.dispatch("cart:changed", { items: 7 });

		await expect(events.waitFor("cart:changed")).resolves.toEqual({ items: 7 });
		events.stop();
	});

	it("rejects on its deadline, naming the event", async () => {
		// Resolving late and silently is how a suite acquires tests that pass
		// without the thing having happened.
		const events = createLankaEventRecorder({ lanka });

		await expect(events.waitFor("never:happens", { timeoutMs: 10 })).rejects.toThrow(
			/never:happens/,
		);
		events.stop();
	});

	it("stops waiting when the recorder stops", async () => {
		const events = createLankaEventRecorder({ lanka });
		const waited = events.waitFor("cart:changed", { timeoutMs: 20 });

		events.stop();
		lanka.eventBus.dispatch("cart:changed", { items: 1 });

		// A listener left behind would resolve here, and the test would be asserting
		// on a recorder it had already dismissed.
		await expect(waited).rejects.toThrow(/cart:changed/);
	});
});
