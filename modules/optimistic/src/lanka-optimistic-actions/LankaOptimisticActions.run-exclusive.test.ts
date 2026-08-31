import { describe, it, expect, vi, beforeEach } from "vitest";
import { LankaOptimisticActions } from "./LankaOptimisticActions";

function deferred<T = void>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return {
		promise,
		resolve,
		reject,
	};
}

function makeAbortError(): DOMException {
	return new DOMException("The operation was aborted.", "AbortError");
}

describe("LankaOptimisticActions — runExclusive", () => {
	let service: LankaOptimisticActions;

	beforeEach(() => {
		service = new LankaOptimisticActions();
	});

	it('applies optimistic update and reports "executed" on success', async () => {
		const applyOptimistic = vi.fn(() => "snapshot");
		const onSuccess = vi.fn();

		const result = await service.runExclusive(
			"k",
			applyOptimistic,
			async () => "server-result",
			vi.fn(),
			onSuccess,
		);

		expect(result).toBe("executed");
		expect(applyOptimistic).toHaveBeenCalledTimes(1);
		expect(onSuccess).toHaveBeenCalledWith("server-result");
	});

	it('rolls back and reports "failed" on non-abort error', async () => {
		const rollback = vi.fn();

		const result = await service.runExclusive(
			"k",
			() => "prev",
			async () => {
				throw new Error("fail");
			},
			rollback,
		);

		expect(result).toBe("failed");
		expect(rollback).toHaveBeenCalledWith("prev");
	});

	it("passes an AbortSignal to the request callback", async () => {
		let receivedSignal: AbortSignal | undefined;

		await service.runExclusive(
			"k",
			() => null,
			async (signal) => {
				receivedSignal = signal;
			},
			vi.fn(),
		);

		expect(receivedSignal).toBeInstanceOf(AbortSignal);
	});

	it("blocks concurrent calls for the same key — returns false immediately", async () => {
		const d = deferred();
		const applySecond = vi.fn(() => null);

		const first = service.runExclusive(
			"k",
			() => null,
			() => d.promise,
			vi.fn(),
		);

		const secondResult = await service.runExclusive("k", applySecond, async () => {}, vi.fn());

		expect(secondResult).toBe("blocked");
		expect(applySecond).not.toHaveBeenCalled();

		d.resolve();
		const firstResult = await first;
		expect(firstResult).toBe("executed");
	});

	it("does NOT block calls for different keys", async () => {
		const d = deferred();
		const onSuccessA = vi.fn();
		const onSuccessB = vi.fn();

		const a = service.runExclusive(
			"a",
			() => null,
			() => d.promise,
			vi.fn(),
			onSuccessA,
		);
		const b = service.runExclusive(
			"b",
			() => null,
			async () => {},
			vi.fn(),
			onSuccessB,
		);

		await b;
		d.resolve();
		await a;

		expect(onSuccessA).toHaveBeenCalledTimes(1);
		expect(onSuccessB).toHaveBeenCalledTimes(1);
	});

	it("unlocks after success so subsequent calls can proceed", async () => {
		const onSuccess = vi.fn();

		await service.runExclusive(
			"k",
			() => null,
			async () => {},
			vi.fn(),
			onSuccess,
		);
		await service.runExclusive(
			"k",
			() => null,
			async () => {},
			vi.fn(),
			onSuccess,
		);

		expect(onSuccess).toHaveBeenCalledTimes(2);
	});

	it("unlocks after error so subsequent calls can proceed", async () => {
		const rollback = vi.fn();
		const onSuccess = vi.fn();

		await service.runExclusive(
			"k",
			() => null,
			async () => {
				throw new Error();
			},
			rollback,
		);
		await service.runExclusive(
			"k",
			() => null,
			async () => {},
			vi.fn(),
			onSuccess,
		);

		expect(onSuccess).toHaveBeenCalledTimes(1);
	});

	it("rolls back on abort error too — exclusive ops have no superseding click that would justify skipping rollback", async () => {
		const rollback = vi.fn();

		await service.runExclusive(
			"k",
			() => "prev",
			async () => {
				throw makeAbortError();
			},
			rollback,
		);

		expect(rollback).toHaveBeenCalledWith("prev");
	});

	it("aborts the in-flight request and rolls back after timeoutMs to prevent a hanging request from freezing the lock", async () => {
		vi.useFakeTimers();
		try {
			const rollback = vi.fn();
			let signalRef: AbortSignal | undefined;
			const d = deferred();

			const pending = service.runExclusive(
				"k",
				() => "prev",
				(signal) => {
					signalRef = signal;
					signal.addEventListener("abort", () => d.reject(makeAbortError()));
					return d.promise;
				},
				rollback,
				undefined,
				100,
			);

			expect(service.isExclusiveLocked("k")).toBe(true);

			await vi.advanceTimersByTimeAsync(150);
			const result = await pending;

			expect(signalRef?.aborted).toBe(true);
			expect(rollback).toHaveBeenCalledWith("prev");
			expect(result).toBe("failed");
			expect(service.isExclusiveLocked("k")).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("clears the timeout when the request resolves before timeoutMs", async () => {
		vi.useFakeTimers();
		try {
			const onSuccess = vi.fn();
			const rollback = vi.fn();

			await service.runExclusive(
				"k",
				() => "prev",
				async () => "ok",
				rollback,
				onSuccess,
				100,
			);

			// Past the timeout — no late abort, no late rollback.
			await vi.advanceTimersByTimeAsync(200);

			expect(onSuccess).toHaveBeenCalledWith("ok");
			expect(rollback).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it("isExclusiveLocked returns true while in-flight and false after", async () => {
		const d = deferred();

		const pending = service.runExclusive(
			"k",
			() => null,
			() => d.promise,
			vi.fn(),
		);

		expect(service.isExclusiveLocked("k")).toBe(true);

		d.resolve();
		await pending;

		expect(service.isExclusiveLocked("k")).toBe(false);
	});

	it("works without optimistic update (plain abort-aware function)", async () => {
		const onSuccess = vi.fn();
		const result = await service.runExclusive(
			"k",
			() => null,
			async () => "result",
			() => {},
			onSuccess,
		);
		expect(result).toBe("executed");
		expect(onSuccess).toHaveBeenCalledWith("result");
	});
	it("distinguishes “already running” from “ran and failed”", async () => {
		// They are handled oppositely: the first is ignored silently, the second is
		// reported. A single `false` for both surfaces a network failure to the user
		// as "action already running".
		const blocking = deferred();
		const held = service.runExclusive(
			"k",
			() => null,
			() => blocking.promise,
			vi.fn(),
		);

		const blocked = await service.runExclusive(
			"k",
			() => null,
			async () => {},
			vi.fn(),
		);

		expect(blocked).toBe("blocked");
		blocking.resolve();
		await held;

		const failed = await service.runExclusive(
			"k",
			() => null,
			async () => {
				throw new Error("offline");
			},
			vi.fn(),
		);

		expect(failed).toBe("failed");
	});
});
