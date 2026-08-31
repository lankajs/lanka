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

describe("LankaOptimisticActions — runLatest", () => {
	let service: LankaOptimisticActions;

	beforeEach(() => {
		service = new LankaOptimisticActions();
	});

	it("applies optimistic update immediately before request resolves", async () => {
		const applyOptimistic = vi.fn(() => "snapshot");
		const d = deferred();

		void service.runLatest("k", applyOptimistic, () => d.promise, vi.fn());

		expect(applyOptimistic).toHaveBeenCalledTimes(1);
		d.resolve();
	});

	it("calls onSuccess after request resolves", async () => {
		const onSuccess = vi.fn();
		await service.runLatest(
			"k",
			() => null,
			async () => {},
			vi.fn(),
			onSuccess,
		);

		expect(onSuccess).toHaveBeenCalledTimes(1);
	});

	it("rolls back on non-abort request failure", async () => {
		const rollback = vi.fn();
		await service.runLatest(
			"k",
			() => "prev",
			async () => {
				throw new Error("fail");
			},
			rollback,
		);

		expect(rollback).toHaveBeenCalledWith("prev");
	});

	it("passes an AbortSignal to the request callback", async () => {
		let receivedSignal: AbortSignal | undefined;

		await service.runLatest(
			"k",
			() => null,
			async (signal) => {
				receivedSignal = signal;
			},
			vi.fn(),
		);

		expect(receivedSignal).toBeInstanceOf(AbortSignal);
	});

	it("aborts the previous controller when a newer call arrives", async () => {
		const d = deferred();
		let firstSignal!: AbortSignal;

		const first = service.runLatest(
			"k",
			() => null,
			async (signal) => {
				firstSignal = signal;
				await d.promise;
			},
			vi.fn(),
		);

		const second = service.runLatest(
			"k",
			() => null,
			async () => {},
			vi.fn(),
		);

		expect(firstSignal.aborted).toBe(true);

		await second;
		d.resolve();
		await first;
	});

	it("does NOT call onSuccess for the superseded (aborted) call", async () => {
		const d = deferred();
		const onSuccessFirst = vi.fn();
		const onSuccessSecond = vi.fn();

		const first = service.runLatest(
			"k",
			() => null,
			async (signal) => {
				await d.promise;
				if (signal.aborted) throw makeAbortError();
			},
			vi.fn(),
			onSuccessFirst,
		);

		const second = service.runLatest(
			"k",
			() => null,
			async () => {},
			vi.fn(),
			onSuccessSecond,
		);

		await second;
		d.resolve();
		await first;

		expect(onSuccessFirst).not.toHaveBeenCalled();
		expect(onSuccessSecond).toHaveBeenCalledTimes(1);
	});

	it("does NOT roll back when aborted (abort is not a user-visible error)", async () => {
		const d = deferred();
		const rollbackFirst = vi.fn();

		const first = service.runLatest(
			"k",
			() => "snap",
			async (signal) => {
				await d.promise;
				if (signal.aborted) throw makeAbortError();
			},
			rollbackFirst,
		);

		await service.runLatest(
			"k",
			() => null,
			async () => {},
			vi.fn(),
		);
		d.resolve();
		await first;

		expect(rollbackFirst).not.toHaveBeenCalled();
	});

	it("does NOT roll back when superseded by a non-abort error in the stale call", async () => {
		const d = deferred<void>();
		const rollbackFirst = vi.fn();
		const rollbackSecond = vi.fn();

		const first = service.runLatest(
			"k",
			() => "snap1",
			async () => {
				await d.promise;
			},
			rollbackFirst,
		);

		const second = service.runLatest(
			"k",
			() => null,
			async () => {},
			rollbackSecond,
		);

		await second;
		d.reject(new Error("network error"));
		await first;

		expect(rollbackFirst).not.toHaveBeenCalled();
		expect(rollbackSecond).not.toHaveBeenCalled();
	});

	it("handles multiple independent keys independently", async () => {
		const onSuccessA = vi.fn();
		const onSuccessB = vi.fn();

		await Promise.all([
			service.runLatest(
				"a",
				() => null,
				async () => {},
				vi.fn(),
				onSuccessA,
			),
			service.runLatest(
				"b",
				() => null,
				async () => {},
				vi.fn(),
				onSuccessB,
			),
		]);

		expect(onSuccessA).toHaveBeenCalledTimes(1);
		expect(onSuccessB).toHaveBeenCalledTimes(1);
	});

	it("isLatestPending returns true while in-flight and false after", async () => {
		const d = deferred();

		const pending = service.runLatest(
			"k",
			() => null,
			() => d.promise,
			vi.fn(),
		);

		expect(service.isLatestPending("k")).toBe(true);

		d.resolve();
		await pending;

		expect(service.isLatestPending("k")).toBe(false);
	});

	it("third call supersedes second — only third onSuccess fires", async () => {
		const d1 = deferred();
		const d2 = deferred();
		const onSuccess1 = vi.fn();
		const onSuccess2 = vi.fn();
		const onSuccess3 = vi.fn();

		const first = service.runLatest(
			"k",
			() => null,
			() => d1.promise,
			vi.fn(),
			onSuccess1,
		);
		const second = service.runLatest(
			"k",
			() => null,
			() => d2.promise,
			vi.fn(),
			onSuccess2,
		);
		const third = service.runLatest(
			"k",
			() => null,
			async () => {},
			vi.fn(),
			onSuccess3,
		);

		await third;
		d2.resolve();
		await second;
		d1.resolve();
		await first;

		expect(onSuccess1).not.toHaveBeenCalled();
		expect(onSuccess2).not.toHaveBeenCalled();
		expect(onSuccess3).toHaveBeenCalledTimes(1);
	});

	it("works without optimistic update (plain abort-aware function)", async () => {
		const onSuccess = vi.fn();
		await service.runLatest(
			"k",
			() => null,
			async () => {
				/* plain side-effectful call */
			},
			() => {},
			onSuccess,
		);
		expect(onSuccess).toHaveBeenCalledTimes(1);
	});
});
