import { nanoquery } from "@nanostores/query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetActiveLanka } from "lanka/bootstrap";
import { createLankaFakeReadCache } from "@lankajs/tool-testing";
import { lankaReadCacheConformance } from "@lankajs/tool-testing/lankaReadCacheConformance";
import { createLankaNanostoresCache, LankaNanostoresCache } from "../src/index";
import {
	createPlaygroundArticleVM,
	createPlaygroundTransport,
	PlaygroundArticleGateway,
	startPlayground,
} from "./app";
import type { ILankaReadCache } from "lanka/cache";
import type { TLankaNanostoresClient } from "../src/index";
import type { IPlaygroundApp, IPlaygroundArticle, IPlaygroundTransport } from "./app";

/**
 * The package, used as an application uses it.
 *
 * What matters is not that nanostores caches — its own tests cover that — but
 * that a ViewModel reading through the port never learns a word of it, and that
 * the screen above behaves the same as it does over the recommended member.
 *
 * The scenes run over this package AND over `createLankaFakeReadCache`, because
 * identical assertions over two implementations are what make the port a port.
 */

const articles = (): IPlaygroundArticle[] => [
	{ slug: "ports", title: "What a port promises", readers: 2 },
	{ slug: "caches", title: "Where a cache belongs", readers: 5 },
];

// The endpoint carries the host's base URL, so the tail is what identifies it.
const gets = (transport: IPlaygroundTransport, slug: string) =>
	transport.calls.filter((call) => call.startsWith("GET ") && call.endsWith(`/articles/${slug}`));

let app: IPlaygroundApp | null = null;

beforeEach(() => {
	resetActiveLanka();
});

afterEach(() => {
	app?.lanka.dispose();
	app = null;
});

describe("the nanostores playground", () => {
	it("costs ONE request for two screens opening one article", async () => {
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);

		await Promise.all([
			app.useArticleVM.getState().open("ports"),
			app.useSidebarVM.getState().open("ports"),
		]);

		expect(gets(transport, "ports")).toHaveLength(1);
		expect(app.useArticleVM.getState().article?.title).toBe("What a port promises");
	});

	it("marks a change made elsewhere instead of swapping it in silently", async () => {
		// The rule the Forms boundary states one layer up: what arrives from
		// elsewhere is MARKED, and the person decides. A screen that swapped the
		// text under a reader would be the same defect as a form reset mid-typing.
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);
		await app.useArticleVM.getState().open("ports");

		app.cache.write(["article", "ports"], {
			slug: "ports",
			title: "What a port promises, revised",
			readers: 3,
		});

		const state = app.useArticleVM.getState();
		expect(state.changedElsewhere).toBe(true);
		expect(state.article?.title).toBe("What a port promises, revised");
	});

	it("does not call the first answer a change", async () => {
		// Clause 1, from a screen's point of view: subscribing before reading must
		// not hand the ViewModel an event, or every screen would open already
		// believing somebody else had edited it.
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);

		await app.useArticleVM.getState().open("ports");

		expect(app.useArticleVM.getState().changedElsewhere).toBe(false);
	});

	it("stops hearing when the screen closes", async () => {
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);
		await app.useArticleVM.getState().open("ports");

		app.useArticleVM.getState().close();
		app.cache.write(["article", "ports"], {
			slug: "ports",
			title: "After it closed",
			readers: 1,
		});

		expect(app.useArticleVM.getState().article?.title).toBe("What a port promises");
	});

	it("closes a screen whose request is in flight, and says what that does NOT do", async () => {
		// `cancel` is absent on this member, so `close()` cannot stop the request —
		// the optional call at the call site is what makes that visible in the code
		// rather than in a comment. The answer arrives and is discarded.
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);

		const opening = app.useArticleVM.getState().open("ports");
		app.useArticleVM.getState().close();
		await opening;

		expect(app.cache.cancel).toBeUndefined();
	});

	it("asks again for a different article, and keeps the first", async () => {
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);

		await app.useArticleVM.getState().open("ports");
		await app.useSidebarVM.getState().open("caches");

		expect(gets(transport, "ports")).toHaveLength(1);
		expect(gets(transport, "caches")).toHaveLength(1);
		expect(app.cache.peek(["article", "ports"])).toMatchObject({ slug: "ports" });
	});

	it("keeps the other screen hearing after one of them closes", async () => {
		// This library attaches its store's listeners only WHILE a consumer is
		// subscribed, and detaches when the last one goes. A member that tracked
		// "is anything listening" with a boolean rather than a count would stop
		// telling the sidebar the moment the article pane closed.
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);
		await app.useArticleVM.getState().open("ports");
		await app.useSidebarVM.getState().open("ports");

		app.useArticleVM.getState().close();
		transport.articles[0].title = "Changed after the pane closed";
		await app.cache.invalidate(["article", "ports"]);
		await new Promise((resolve) => setTimeout(resolve, 60));

		expect(app.useSidebarVM.getState().article?.title).toBe("Changed after the pane closed");
		expect(app.useArticleVM.getState().changedElsewhere).toBe(false);
	});

	it("costs ONE request for THREE screens opening one article", async () => {
		// Two readers can be deduplicated by a lock that happens to cover the gap;
		// a third asks whether there is one entry per key or a race usually won.
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);
		const third = createPlaygroundArticleVM(
			new PlaygroundArticleGateway(transport),
			app.cache,
			"PlaygroundThirdVM",
		);

		await Promise.all([
			app.useArticleVM.getState().open("ports"),
			app.useSidebarVM.getState().open("ports"),
			third.getState().open("ports"),
		]);

		expect(gets(transport, "ports")).toHaveLength(1);
		expect(third.getState().article?.title).toBe("What a port promises");
	});

	it("asks again when the article is invalidated, and the open screen hears it", async () => {
		// Clause 8 from a screen's point of view. A subscribed key refetches by
		// itself, so the person reading is told; an unwatched one would only be
		// marked stale, and nothing would go out until somebody read it again.
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);
		await app.useArticleVM.getState().open("ports");

		transport.articles[0].title = "Rewritten upstream";
		await app.cache.invalidate(["article", "ports"]);
		await new Promise((resolve) => setTimeout(resolve, 60));

		expect(gets(transport, "ports")).toHaveLength(2);
		expect(app.useArticleVM.getState().changedElsewhere).toBe(true);
		expect(app.useArticleVM.getState().article?.title).toBe("Rewritten upstream");
	});

	it("stops hearing the first article when the screen moves to the next", async () => {
		// Navigation, which is a release the screen never calls `close()` for: the
		// second `open()` replaces the held release. Keeping both would have a
		// detail pane marked "changed elsewhere" by an article it left.
		const transport = createPlaygroundTransport(articles());
		app = await startPlayground(transport);
		await app.useArticleVM.getState().open("ports");
		await app.useArticleVM.getState().open("caches");

		app.cache.write(["article", "ports"], {
			slug: "ports",
			title: "Changed after the reader left",
			readers: 4,
		});

		expect(app.useArticleVM.getState().article?.slug).toBe("caches");
		expect(app.useArticleVM.getState().changedElsewhere).toBe(false);
	});
});

/**
 * The family's shared assertions, imported rather than written.
 *
 * The point of a second member is that the SAME suite passes over a library
 * built on other ideas: a listener that does not fire on attach, an invalidation
 * stated as two functions, and no cancellation at all.
 */
lankaReadCacheConformance({
	vendor: "nanostores",
	create: () => createLankaNanostoresCache(nanoquery() as unknown as TLankaNanostoresClient),
	settleMs: 40,
});

describe("the class style, which is the same implementation", () => {
	it("answers what the built one answers", async () => {
		// Typed as the PORT, which is how a ViewModel holds it — and where the
		// absent `cancel` is visible as an optional member rather than as nothing.
		const built: ILankaReadCache = new LankaNanostoresCache(
			nanoquery() as unknown as TLankaNanostoresClient,
		);

		await built.read(["article", "ports"], () => Promise.resolve({ slug: "ports" }), {
			staleMs: 60_000,
		});

		expect(built.peek(["article", "ports"])).toEqual({ slug: "ports" });
		expect(built.cancel).toBeUndefined();
	});
});

describe("the same ViewModel, over the fake", () => {
	it("opens, deduplicates and marks a change, with no vendor installed", async () => {
		const transport = createPlaygroundTransport(articles());
		const fake = createLankaFakeReadCache();
		app = await startPlayground(transport);

		const gateway = app.lanka.locators.gateways.get("playgroundArticleGateway");
		const useArticle = createPlaygroundArticleVM(gateway as never, fake, "OverTheFakeA");
		const useSidebar = createPlaygroundArticleVM(gateway as never, fake, "OverTheFakeB");

		await Promise.all([
			useArticle.getState().open("ports"),
			useSidebar.getState().open("ports"),
		]);
		fake.write(["article", "ports"], { slug: "ports", title: "From the fake", readers: 1 });

		expect(gets(transport, "ports")).toHaveLength(1);
		expect(useArticle.getState().changedElsewhere).toBe(true);
		// The fake DOES declare `cancel`, and the same ViewModel simply uses it.
		expect(fake.cancel).toBeTypeOf("function");
	});
});
