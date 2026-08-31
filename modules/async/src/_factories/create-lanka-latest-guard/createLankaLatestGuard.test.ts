import { describe, expect, it } from "vitest";
import { createLankaLatestGuard } from "./createLankaLatestGuard";

describe("createLankaLatestGuard", () => {
	it("only the most recently started request counts as current", () => {
		const guard = createLankaLatestGuard();

		const firstToken = guard.start();
		const secondToken = guard.start();

		expect(guard.isCurrent(firstToken)).toBe(false);
		expect(guard.isCurrent(secondToken)).toBe(true);
	});

	it("invalidates an in-flight request when realtime delivered something fresher", () => {
		const guard = createLankaLatestGuard();

		const requestToken = guard.start();
		guard.invalidate();

		expect(guard.isCurrent(requestToken)).toBe(false);
	});

	it("a token stays current until something starts again", () => {
		// Otherwise the guard would reject the one honest answer too, and the screen
		// would never update — a failure quieter than showing stale data.
		const guard = createLankaLatestGuard();

		const token = guard.start();

		expect(guard.isCurrent(token)).toBe(true);
		expect(guard.isCurrent(token)).toBe(true);
	});

	it("a token issued by another guard is not automatically current", () => {
		// Guards are independent: shared static state would make a refresh on one
		// screen cancel a read on another.
		const first = createLankaLatestGuard();
		const second = createLankaLatestGuard();

		first.start();
		first.start();
		const secondToken = second.start();

		expect(first.isCurrent(secondToken)).toBe(false);
		expect(second.isCurrent(secondToken)).toBe(true);
	});
});
