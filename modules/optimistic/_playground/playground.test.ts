import { describe, expect, it, vi } from "vitest";
import { createLankaOptimisticActions, LankaOptimisticActions } from "../src/index";
import { createPlaygroundEditor } from "./app";

/**
 * The package, used as a post editor uses it.
 *
 * The two strategies differ in what counts as a failure, and that difference is
 * only visible with a whole action in front of you.
 */
const post = () => ({ id: 1, likes: 10, isLiked: false, isPublished: false });

const deferred = () => {
	let settle: () => void = () => undefined;
	const promise = new Promise<void>((resolve) => {
		settle = resolve;
	});
	return { promise, settle };
};

describe("the optimistic playground", () => {
	it("shows the like before the server has answered", async () => {
		const editor = createPlaygroundEditor(post());
		const inFlight = deferred();

		const done = editor.like(() => inFlight.promise);
		expect(editor.post.isLiked).toBe(true);
		expect(editor.post.likes).toBe(11);

		inFlight.settle();
		await done;
	});

	it("keeps the like once the server agrees", async () => {
		const editor = createPlaygroundEditor(post());

		await editor.like(() => Promise.resolve());

		expect(editor.post.isLiked).toBe(true);
		expect(editor.post.likes).toBe(11);
	});

	it("rolls the like back when the server refuses", async () => {
		const editor = createPlaygroundEditor(post());

		await editor.like(() => Promise.reject(new Error("nope")));

		expect(editor.post.isLiked).toBe(false);
		expect(editor.post.likes).toBe(10);
	});

	it("publishes once, however many times the button is tapped", async () => {
		const editor = createPlaygroundEditor(post());
		const send = vi.fn(() => Promise.resolve());

		await Promise.all([editor.publish(send), editor.publish(send), editor.publish(send)]);

		expect(send).toHaveBeenCalledOnce();
		expect(editor.post.isPublished).toBe(true);
	});

	it("rolls publishing back on failure, so the screen stops claiming it", async () => {
		const editor = createPlaygroundEditor(post());

		await editor.publish(() => Promise.reject(new Error("nope")));

		expect(editor.post.isPublished).toBe(false);
	});

	it("tells a refusal apart from an attempt that never ran", async () => {
		// Handled oppositely: the first is ignored, the second is reported. One
		// boolean for both showed a network failure as "already running".
		const editor = createPlaygroundEditor(post());
		const blocking = deferred();

		const first = editor.publish(() => blocking.promise);
		const blocked = await editor.publish(() => Promise.resolve());

		blocking.settle();
		const ran = await first;

		expect(blocked).toBe("blocked");
		expect(ran).not.toBe("blocked");
	});
});

describe("either style builds the same optimistic actions", () => {
	it("runs the latest through both", async () => {
		const built = createLankaOptimisticActions();
		const constructed = new LankaOptimisticActions();

		let fromBuilt = 0;
		let fromConstructed = 0;

		await built.runLatest<number>(
			"like",
			() => 0,
			() => {
				fromBuilt += 1;
				return Promise.resolve();
			},
			() => undefined,
		);
		await constructed.runLatest<number>(
			"like",
			() => 0,
			() => {
				fromConstructed += 1;
				return Promise.resolve();
			},
			() => undefined,
		);

		expect(fromBuilt).toBe(fromConstructed);
	});
});
