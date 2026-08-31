import { describe, expect, it } from "vitest";
import { hydrateLankaVM } from "../src/index";
import { runLankaRequest, runLankaStatic } from "../src/server";
import { createPlaygroundApi, createPlaygroundPostsVM, PlaygroundPostGateway } from "./app";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaPlugin } from "lanka";

/**
 * The package, used the way a page in a host framework uses it.
 *
 * The units prove each half. Only a scene can prove the SEAM: that what a loader
 * fetched on the server is what the screen starts from in the browser, and that
 * the browser then asks the API for nothing.
 */
const posts = () => [
	{ slug: "first", title: "The first post" },
	{ slug: "second", title: "The second post" },
];

describe("the host playground", () => {
	it("renders a screen from server data without the browser fetching anything", async () => {
		const api = createPlaygroundApi(posts());
		const useVM = createPlaygroundPostsVM();

		// The server side: a loader, inside its own instance.
		const loaded = await runLankaRequest(
			{ host: lankaTestHost, headers: { cookie: "session=abc" } },
			() => new PlaygroundPostGateway(api.transport).published(),
		);

		// The browser side: the same data, as the screen's first state.
		hydrateLankaVM(useVM, { posts: loaded });

		expect(useVM.getState().posts).toHaveLength(2);
		expect(useVM.getState().loads).toBe(0);
		expect(api.calls()).toBe(1);
	});

	it("reaches the API as the person who asked for the page", async () => {
		const api = createPlaygroundApi(posts());

		await runLankaRequest(
			{ host: lankaTestHost, headers: { cookie: "session=abc", host: "example.com" } },
			() => new PlaygroundPostGateway(api.transport).published(),
		);

		expect(api.seen[0]).toMatchObject({ cookie: "session=abc" });
		expect(api.seen[0]).not.toHaveProperty("host");
	});

	it("prerenders the same screen with nobody's identity attached", async () => {
		const api = createPlaygroundApi(posts());

		const slugs = await runLankaStatic({ host: lankaTestHost }, async () => {
			const all = await new PlaygroundPostGateway(api.transport).published();
			return all.map((post) => post.slug);
		});

		expect(slugs).toEqual(["first", "second"]);
		expect(api.seen[0]).toBeUndefined();
	});

	it("leaves a hydrated screen alone when the browser loads again", async () => {
		// What the second half of hydration is for: the user's own edits survive a
		// re-render, and a late snapshot does not undo them.
		const api = createPlaygroundApi(posts());
		const useVM = createPlaygroundPostsVM();
		const loaded = await runLankaRequest({ host: lankaTestHost }, () =>
			new PlaygroundPostGateway(api.transport).published(),
		);
		hydrateLankaVM(useVM, { posts: loaded });

		useVM.getState().loadInTheBrowser([{ slug: "third", title: "Added in the browser" }]);
		hydrateLankaVM(useVM, { posts: loaded });

		expect(useVM.getState().posts).toEqual([{ slug: "third", title: "Added in the browser" }]);
		expect(useVM.getState().loads).toBe(1);
	});
});

describe("the host playground, under load and under failure", () => {
	it("gives two overlapping readers their OWN identity at the API", async () => {
		// The leak this package exists to prevent, seen from the outside: two
		// people asking for the same page at the same time, and one of them
		// receiving the other's data because a process-wide instance answered for
		// both.
		const api = createPlaygroundApi(posts());
		const gateway = () => new PlaygroundPostGateway(api.transport);

		// Coordinated rather than timed: a timer long enough on one machine is not
		// long enough on a slower one, and the order the API saw would then be the
		// scheduler's answer instead of this package's.
		let releaseAda = (): void => undefined;
		const graceHasAsked = new Promise<void>((resolve) => {
			releaseAda = resolve;
		});

		const slow = runLankaRequest(
			{ host: lankaTestHost, headers: { cookie: "session=ada" } },
			async () => {
				await graceHasAsked;
				return gateway().published();
			},
		);
		const fast = runLankaRequest(
			{ host: lankaTestHost, headers: { cookie: "session=grace" } },
			async () => {
				const posts = await gateway().published();
				releaseAda();
				return posts;
			},
		);

		await Promise.all([fast, slow]);

		expect(api.seen.map((headers) => headers?.cookie)).toEqual([
			"session=grace",
			"session=ada",
		]);
	});

	it("hands a failed loader a tagged failure, not a bare error", async () => {
		// What a host's error boundary reads. The scope disposes its instance on
		// the way out, and a `finally` that swallowed the rejection — or replaced
		// its kind — would leave the page with nothing to branch on.
		const api = createPlaygroundApi(posts());
		api.failWith = 503;

		const failure = await runLankaRequest({ host: lankaTestHost }, () =>
			new PlaygroundPostGateway(api.transport).published(),
		).catch((error: unknown) => error);

		expect(failure).toMatchObject({ kind: "http", status: 503 });
	});

	it("lets a plugin's policy see the forwarded identity on a retry", async () => {
		// Order matters and is asserted here rather than described: forwarding is
		// installed BEFORE the plugins, so it wraps them. An auth-refresh policy
		// that restarts a request must see the cookie on the second attempt too.
		const api = createPlaygroundApi(posts());
		const retryOnce: ILankaPlugin = {
			name: "playground-retry",
			install: (lanka) =>
				lanka.useRequestMiddleware(async (ctx, next) => {
					await next(ctx);
					return next(ctx);
				}),
		};

		await runLankaRequest(
			{ host: lankaTestHost, headers: { cookie: "session=ada" }, plugins: [retryOnce] },
			() => new PlaygroundPostGateway(api.transport).published(),
		);

		expect(api.calls()).toBe(2);
		expect(api.seen.every((headers) => headers?.cookie === "session=ada")).toBe(true);
	});

	it("prerenders many pages in one build without them sharing an instance", async () => {
		// What SSG actually does: a scope per page, in a loop or in parallel. Each
		// has to stand on its own, or the last page's flags decide the first
		// page's output.
		const api = createPlaygroundApi(posts());

		const built = await Promise.all(
			["first", "second", "third"].map((slug) =>
				runLankaStatic({ host: lankaTestHost, flags: { isMockMode: false } }, async () => {
					const all = await new PlaygroundPostGateway(api.transport).published();
					return { slug, count: all.length };
				}),
			),
		);

		expect(built).toEqual([
			{ slug: "first", count: 2 },
			{ slug: "second", count: 2 },
			{ slug: "third", count: 2 },
		]);
		expect(api.seen.every((headers) => headers === undefined)).toBe(true);
	});
});
