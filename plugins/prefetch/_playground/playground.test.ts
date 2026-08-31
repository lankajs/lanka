import { afterEach, describe, expect, it } from "vitest";
import { resetActiveLanka } from "lanka";
import { lankaRouterChunkSource } from "../src/lanka-router-chunk-source/lankaRouterChunkSource";
import { playgroundOrderResource, startPlaygroundNavigation } from "./app";

/**
 * The package, used as a router uses it.
 *
 * The ladder is the whole product, and a ladder needs every rung present to be
 * observable: each rung on its own is a unit test, the ORDER between them is
 * only visible here.
 */
type TNavigation = ReturnType<typeof startPlaygroundNavigation>;

let app: TNavigation | null = null;

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	resetActiveLanka();
});

describe("the prefetch playground", () => {
	it("sweeps route chunks while the wire is quiet", async () => {
		app = startPlaygroundNavigation();

		app.prefetch.chunk.start();
		await app.sweep();

		expect(app.pulled.length).toBeGreaterThan(0);
	});

	it("pulls the higher-priority route first", async () => {
		app = startPlaygroundNavigation();

		app.prefetch.chunk.start();
		await app.sweep();

		expect(app.pulled[0]).toBe("/orders");
	});

	it("counts nothing as active before it starts", () => {
		app = startPlaygroundNavigation();

		expect(app.prefetch.chunk.getActiveCount()).toBe(0);
	});

	it("stands down while a real request is on the wire", async () => {
		// The rule the package exists for. Speculative work competing with a screen
		// the user IS waiting for is worse than no speculative work.
		app = startPlaygroundNavigation();
		const finish = app.beginRealRequest();

		app.prefetch.chunk.start();
		await app.sweep();

		expect(app.pulled).toEqual([]);
		finish();
	});

	it("resumes once the wire is quiet again", async () => {
		// The sweep WAITS rather than gives up: a busy wire delays warming, it does
		// not cancel it for the session.
		app = startPlaygroundNavigation();
		const finish = app.beginRealRequest();
		app.prefetch.chunk.start();
		await app.sweep();

		finish();
		await app.sweep();

		expect(app.pulled.length).toBeGreaterThan(0);
	});

	it("stops when paused and continues when resumed", async () => {
		// A pause is what a real navigation asks for: the screen the user IS
		// waiting for must not compete with one they might never open.
		app = startPlaygroundNavigation();
		app.prefetch.chunk.pause();
		app.prefetch.chunk.start();
		await app.sweep();
		const whilePaused = app.pulled.length;

		app.prefetch.chunk.resume();
		await app.sweep();

		expect(whilePaused).toBe(0);
		expect(app.prefetch.chunk.getDiagnostics().isPaused).toBe(false);
	});

	it("warms an intent and hands the claim to whoever navigates", async () => {
		app = startPlaygroundNavigation();

		app.prefetch.intent.lankaPrefetch(playgroundOrderResource, { id: "7" });
		const claimed = await app.prefetch.intent.claim(playgroundOrderResource, { id: "7" });

		// The point of the buffer: the screen that arrives second pays nothing.
		expect(claimed).toEqual({ id: 7 });
	});

	it("hands nothing to a claim nobody warmed", () => {
		app = startPlaygroundNavigation();

		expect(app.prefetch.intent.claim(playgroundOrderResource, { id: "404" })).toBeUndefined();
	});

	it("claims a warmed value once, and not twice", async () => {
		// A claim consumes: two screens claiming one warm-up would let the second
		// render from a value the first already acted on.
		app = startPlaygroundNavigation();
		app.prefetch.intent.lankaPrefetch(playgroundOrderResource, { id: "7" });

		await app.prefetch.intent.claim(playgroundOrderResource, { id: "7" });

		expect(app.prefetch.intent.claim(playgroundOrderResource, { id: "7" })).toBeUndefined();
	});

	it("drops what it warmed when the resource is invalidated", () => {
		// A warmed value that outlives its truth is worse than a cold start: the
		// screen shows something confidently wrong.
		app = startPlaygroundNavigation();
		app.prefetch.intent.lankaPrefetch(playgroundOrderResource, { id: "7" });

		app.prefetch.intent.invalidate(playgroundOrderResource.id);

		expect(app.prefetch.intent.claim(playgroundOrderResource, { id: "7" })).toBeUndefined();
	});
});

describe("the route manifest a router already has", () => {
	it("becomes a chunk source without naming a router", async () => {
		app = startPlaygroundNavigation();

		app.prefetch.chunk.start();
		await app.sweep();

		// The application passed path, weight and a dynamic import — the three
		// fields TanStack Router, React Router and a hand-written map all have.
		expect(app.pulled[0]).toBe("/orders");
	});

	it("never runs a route's loader while building the list", () => {
		let loaded = 0;
		const source = lankaRouterChunkSource(() => [
			{
				path: "/orders",
				load: () => {
					loaded += 1;
					return Promise.resolve(null);
				},
			},
		]);

		source();

		// Building is not sweeping. A router's own prefetch would run beforeLoad
		// and the loader here — phantom screen views, phantom requests, a
		// corrupted funnel.
		expect(loaded).toBe(0);
	});
});
