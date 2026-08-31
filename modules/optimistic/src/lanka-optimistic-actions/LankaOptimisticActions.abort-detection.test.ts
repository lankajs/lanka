import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaError } from "lanka/errors";
import { LankaOptimisticActions } from "./LankaOptimisticActions";

/**
 * What counts as a cancellation.
 *
 * `runLatest`'s only promise depends on it: a superseded request does NOT roll
 * state back. A check that knows only `DOMException` holds while the caller does
 * the aborting; the framework transport CLASSIFIES cancellation and throws a
 * `LankaError`, so under its own transport the check would not recognise a
 * cancellation and the user's last click would roll itself back.
 */
describe("LankaOptimisticActions — recognising cancellation", () => {
	let service: LankaOptimisticActions;

	beforeEach(() => {
		service = new LankaOptimisticActions();
	});

	it("a `LankaError` with kind aborted triggers no rollback", async () => {
		const rollback = vi.fn();

		await service.runLatest(
			"k",
			() => "prev",
			async () => {
				throw new LankaError({ kind: "aborted", message: "request cancelled" });
			},
			rollback,
		);

		expect(rollback).not.toHaveBeenCalled();
	});

	it("an `AbortError` without DOMException triggers no rollback either", async () => {
		// In node `AbortController` throws a plain `Error` with the same name. A
		// missed cancellation costs more than an extra string comparison.
		const rollback = vi.fn();
		const error = new Error("The operation was aborted.");
		error.name = "AbortError";

		await service.runLatest(
			"k",
			() => "prev",
			async () => {
				throw error;
			},
			rollback,
		);

		expect(rollback).not.toHaveBeenCalled();
	});

	it("a `LankaError` of another kind is an ordinary failure, and rollback happens", async () => {
		// The other side: treating everything as a cancellation would roll back
		// NOTHING, and the optimistic state would stay on screen forever.
		const rollback = vi.fn();

		await service.runLatest(
			"k",
			() => "prev",
			async () => {
				throw new LankaError({ kind: "http", message: "500", status: 500 });
			},
			rollback,
		);

		expect(rollback).toHaveBeenCalledWith("prev");
	});

	it("cancellation in runExclusive rolls back — there is no superseding click", async () => {
		const rollback = vi.fn();

		const outcome = await service.runExclusive(
			"k",
			() => "prev",
			async () => {
				throw new LankaError({ kind: "aborted", message: "request cancelled" });
			},
			rollback,
		);

		expect(rollback).toHaveBeenCalledWith("prev");
		expect(outcome).toBe("failed");
	});
});
