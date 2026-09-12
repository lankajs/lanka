import { QueryClient } from "@tanstack/query-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetActiveLanka } from "lanka/bootstrap";
import { createLankaFakeReadCache } from "@lankajs/tool-testing";
import {
	LANKA_READ_CACHE_SCENES,
	lankaReadCacheConformance,
} from "@lankajs/tool-testing/lankaReadCacheConformance";
import { createLankaTanstackCache, LankaTanstackCache } from "../src/index";
import { createPlaygroundOrdersVM, createPlaygroundTransport, startPlayground } from "./app";
import type { IPlaygroundApp, IPlaygroundOrder, IPlaygroundTransport } from "./app";

/**
 * The package, used as an application uses it.
 *
 * What matters is not that TanStack Query caches — its own tests cover that —
 * but that a ViewModel reading through the port never learns a word of it, and
 * that two screens over one resource cost one request.
 *
 * Every scene runs TWICE: once over this package and once over
 * `createLankaFakeReadCache`. Identical assertions over two implementations are
 * what make the port a port rather than a description of TanStack, and they are
 * why a ViewModel written here can be tested without installing a cache at all.
 */

const orders = (): IPlaygroundOrder[] => [
	{ id: 1, customer: "Ann", updatedAt: 1 },
	{ id: 2, customer: "Bob", updatedAt: 1 },
];

const gets = (transport: IPlaygroundTransport) =>
	transport.calls.filter((call) => call.startsWith("GET ") && call.endsWith("/orders"));

let app: IPlaygroundApp | null = null;

beforeEach(() => {
	resetActiveLanka();
});

afterEach(() => {
	app?.lanka.dispose();
	app = null;
});

describe("the TanStack playground", () => {
	it("costs ONE request for two screens reading one resource", async () => {
		const transport = createPlaygroundTransport(orders());
		app = await startPlayground(transport);

		await Promise.all([app.useOrdersVM.getState().load(), app.useBadgeVM.getState().load()]);

		expect(gets(transport)).toHaveLength(1);
		expect(app.useOrdersVM.getState().orders).toEqual(app.useBadgeVM.getState().orders);
	});

	it("answers the second screen from memory while the answer is fresh", async () => {
		const transport = createPlaygroundTransport(orders());
		app = await startPlayground(transport);

		await app.useOrdersVM.getState().load();
		await app.useBadgeVM.getState().load();

		expect(gets(transport)).toHaveLength(1);
	});

	it("tells the other screen about a change without a scenario", async () => {
		// Neither ViewModel declares `scenarioHandlers`. A reader with a cache
		// underneath hears through the cache, and `onInit` is where it starts
		// listening — a hook that only runs because bootstrap registers a ViewModel
		// for its hooks alone.
		const transport = createPlaygroundTransport(orders());
		app = await startPlayground(transport);
		await app.useOrdersVM.getState().load();
		await app.useBadgeVM.getState().load();

		app.cache.write(["orders"], [{ id: 1, customer: "Ann B", updatedAt: 2 }]);

		expect(app.useBadgeVM.getState().orders).toEqual([
			{ id: 1, customer: "Ann B", updatedAt: 2 },
		]);
	});

	it("shows an optimistic rename at once and takes it back on a refusal", async () => {
		const transport = createPlaygroundTransport(orders());
		app = await startPlayground(transport);
		await app.useOrdersVM.getState().load();
		await app.useBadgeVM.getState().load();

		const saving = app.useOrdersVM.getState().rename(1, "taken");
		// Written into the cache before the request, so BOTH screens show it now.
		expect(app.useBadgeVM.getState().orders[0]?.customer).toBe("taken");

		await saving;

		expect(app.useOrdersVM.getState().orders[0]?.customer).toBe("Ann");
		expect(app.useOrdersVM.getState().screenError).not.toBeNull();
	});

	it("keeps an accepted rename, and both screens have it", async () => {
		const transport = createPlaygroundTransport(orders());
		app = await startPlayground(transport);
		await app.useOrdersVM.getState().load();
		await app.useBadgeVM.getState().load();

		await app.useOrdersVM.getState().rename(1, "Ann B");

		expect(app.useOrdersVM.getState().orders[0]).toMatchObject({
			customer: "Ann B",
			updatedAt: 2,
		});
		expect(app.useBadgeVM.getState().orders[0]?.customer).toBe("Ann B");
	});

	it("hands the component's half the SAME client the ViewModels read through", async () => {
		// The one thing this package cannot enforce and the guide has to say: an
		// application that also reads with `useQuery` must share the instance, or
		// the two halves disagree on the first mutation.
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const transport = createPlaygroundTransport(orders());
		app = await startPlayground(transport, client);

		await app.useOrdersVM.getState().load();

		expect(client.getQueryData(["orders"])).toEqual(orders());
	});
});

/**
 * The family's shared assertions, imported rather than written.
 *
 * Two packages promising the same behaviour in two copies of one spec is two
 * chances for one of them to quietly stop promising it — the same reason the
 * validator family keeps its assertions in the kit.
 */
lankaReadCacheConformance({
	vendor: "TanStack Query",
	create: () => createLankaTanstackCache(new QueryClient()),
});

describe("the class style, which is the same implementation", () => {
	it("answers what the built one answers", async () => {
		// Both styles over one class, so a behaviour cannot reach one and not the
		// other. A consumer picks the style their project already uses.
		const client = new QueryClient();
		const built = new LankaTanstackCache(client);

		await built.read(["order", 7], () => Promise.resolve({ id: 7 }), { staleMs: 60_000 });

		expect(built.peek(["order", 7])).toEqual({ id: 7 });
		expect(client.getQueryData(["order", 7])).toEqual({ id: 7 });
	});
});

describe("bringing your own cache", () => {
	it("is a list of clauses an application can run one at a time", async () => {
		// What somebody implementing the port reads: the scenes are DATA, so a
		// failure names the clause it broke rather than an expectation.
		const clause6 = LANKA_READ_CACHE_SCENES.find((scene) => scene.clause === 6);
		const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

		await clause6?.check(() => createLankaTanstackCache(new QueryClient()), settle);

		expect(clause6?.title).toContain("EXACTLY what the loader threw");
	});
});

describe("the same ViewModel, over the fake", () => {
	it("reads, deduplicates and tells the other screen, with no vendor installed", async () => {
		// The property the port is for: a ViewModel written against it is testable
		// without the library it will run over in production.
		const transport = createPlaygroundTransport(orders());
		const fake = createLankaFakeReadCache();
		app = await startPlayground(transport);

		const gateway = app.lanka.locators.gateways.get("playgroundOrderGateway");
		const useList = createPlaygroundOrdersVM(gateway as never, fake, "OverTheFakeA");
		const useBadge = createPlaygroundOrdersVM(gateway as never, fake, "OverTheFakeB");

		await Promise.all([useList.getState().load(), useBadge.getState().load()]);
		fake.write(["orders"], [{ id: 9, customer: "From the fake", updatedAt: 1 }]);

		expect(gets(transport)).toHaveLength(1);
		expect(useBadge.getState().orders[0]?.customer).toBe("From the fake");
	});

	it("is the same cache to a ViewModel, whichever built it", () => {
		// Both answer `ILankaReadCache`, and the screen above them cannot tell.
		const client = new QueryClient();
		expect(Object.keys(createLankaTanstackCache(client))).toEqual(
			expect.arrayContaining([] as string[]),
		);
		expect(typeof createLankaFakeReadCache().read).toBe("function");
	});
});
