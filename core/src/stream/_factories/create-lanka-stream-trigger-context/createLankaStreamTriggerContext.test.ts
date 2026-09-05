import { describe, expect, it } from "vitest";
import { createLankaStreamTriggerContext } from "./createLankaStreamTriggerContext";

/**
 * The marker whose failure is silent.
 *
 * Nothing throws when it is wrong: a screen simply notifies the user about their
 * own action, or rolls an optimistic update back on a response that confirms it.
 * So every boundary of it is pinned here rather than left to a bridge's test.
 */
describe("the from-outside marker", () => {
	it("is off until something runs inside it", () => {
		const trigger = createLankaStreamTriggerContext();

		expect(trigger.isActive()).toBe(false);
	});

	it("is on for the duration of the call", () => {
		const trigger = createLankaStreamTriggerContext();

		expect(trigger.run(() => trigger.isActive())).toBe(true);
	});

	it("answers what the work returned", () => {
		const trigger = createLankaStreamTriggerContext();

		expect(trigger.run(() => 7)).toBe(7);
	});

	it("is cleared when the work threw", () => {
		// A marker left set makes EVERY later user action count as coming from the
		// server — quietly, until a reload.
		const trigger = createLankaStreamTriggerContext();

		expect(() =>
			trigger.run(() => {
				throw new Error("the handler threw");
			}),
		).toThrow("the handler threw");
		expect(trigger.isActive()).toBe(false);
	});

	it("a nested call does not clear the outer marker", () => {
		// Resetting to `false` instead of restoring the previous value would make
		// the rest of the OUTER handler count as a user action.
		const trigger = createLankaStreamTriggerContext();
		const seen: boolean[] = [];

		trigger.run(() => {
			trigger.run(() => undefined);
			seen.push(trigger.isActive());
		});

		expect(seen).toEqual([true]);
	});

	it("is gone after an await, and says so honestly", async () => {
		// The documented boundary: after an `await` control has been anywhere, and
		// claiming "we are still inside a server event" would be untrue.
		const trigger = createLankaStreamTriggerContext();
		let afterAwait = true;

		await trigger.run(async () => {
			await Promise.resolve();
			afterAwait = trigger.isActive();
		});

		expect(afterAwait).toBe(false);
	});

	it("two instances do not share the marker", () => {
		// A module-level flag is one per process: two framework instances — a test
		// beside the app — would see each other's handlers.
		const one = createLankaStreamTriggerContext();
		const other = createLankaStreamTriggerContext();

		expect(one.run(() => other.isActive())).toBe(false);
	});
});
