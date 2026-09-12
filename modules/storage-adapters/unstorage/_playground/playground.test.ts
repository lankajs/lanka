import { describe, expect, it } from "vitest";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import { createLankaUnstorageAdapter, LankaUnstorageAdapter } from "../src/index";
import { createPlaygroundServerSession } from "./app";

/**
 * The package, over the real library.
 *
 * Its three siblings double their engine because a native module cannot run
 * here. This one does not have to, so it does not: every scene below goes
 * through unstorage itself, which is what makes them evidence about the LIBRARY
 * and not only about the mapping.
 */
const engineOf = () => createStorage({ driver: memoryDriver() });

describe("work on a server that outlives the request", () => {
	it("keeps a draft under the name the application gave it", async () => {
		const session = createPlaygroundServerSession(
			createLankaUnstorageAdapter(engineOf()),
			"acme",
		);

		await session.save("7", "half a sentence");

		expect(await session.read("7")).toBe("half a sentence");
		// The key has two slashes in it. unstorage would have made them a path and
		// answered a different spelling; clause 11 is what says it may not.
		expect(await session.drafts()).toEqual(["tenants/acme/drafts/7"]);
	});

	it("is read by a process that did not write it", async () => {
		// What a server store IS. The engine is the shared thing; the sessions are
		// two different pieces of work that never meet.
		const engine = engineOf();

		await createPlaygroundServerSession(createLankaUnstorageAdapter(engine), "acme").save(
			"7",
			"written by the first request",
		);

		const second = createPlaygroundServerSession(createLankaUnstorageAdapter(engine), "acme");

		expect(await second.read("7")).toBe("written by the first request");
	});

	it("keeps one tenant's drafts out of another's listing", async () => {
		const engine = engineOf();
		const acme = createPlaygroundServerSession(createLankaUnstorageAdapter(engine), "acme");
		const globex = createPlaygroundServerSession(createLankaUnstorageAdapter(engine), "globex");

		await acme.save("7", "theirs");
		await globex.save("7", "somebody else's");

		expect(await acme.drafts()).toEqual(["tenants/acme/drafts/7"]);
		expect(await acme.read("7"), "the same id, a different tenant").toBe("theirs");
	});

	it("stores a value that looks like JSON as the string it is", async () => {
		const engine = engineOf();
		const session = createPlaygroundServerSession(createLankaUnstorageAdapter(engine), "acme");

		// The trap `getItem` would have fallen into: unstorage parses on the way
		// out, and a draft whose text happens to be `{}` would come back an object.
		await session.save("7", "{}");
		await session.save("8", "null");

		expect(await session.read("7")).toBe("{}");
		expect(await session.read("8")).toBe("null");
	});

	it("empties everything on a wipe", async () => {
		const engine = engineOf();
		const session = createPlaygroundServerSession(createLankaUnstorageAdapter(engine), "acme");

		await session.save("7", "a");
		await session.save("8", "b");
		await session.wipe();

		expect(await session.drafts()).toEqual([]);
		expect(await engine.getKeys(), "the engine itself").toEqual([]);
	});

	it("is the same adapter whichever style built it", async () => {
		const engine = engineOf();
		const built = new LankaUnstorageAdapter(engine);
		const made = createLankaUnstorageAdapter(engine);

		// A key with a slash, so the escape is exercised from both styles at once.
		await built.setItem("tenants/acme/drafts/7", "half a sentence");

		expect(await made.getItem("tenants/acme/drafts/7")).toBe("half a sentence");
		expect(await made.keys()).toEqual(["tenants/acme/drafts/7"]);
		expect(made).toBeInstanceOf(LankaUnstorageAdapter);
	});
});

/**
 * The family's shared assertions, over the real unstorage.
 *
 * The one member whose conformance run is evidence about a library rather than
 * about a double of one — including clause 11, which is the clause this library
 * made the adapter work for.
 */
lankaStorageAdapterConformance({
	vendor: "unstorage",
	create: () => createLankaUnstorageAdapter(engineOf()),
});

describe("one process, many readers — the rule a server comes with", () => {
	/**
	 * The mistake the guide warns about, shown rather than asserted.
	 *
	 * On a device a storage is one person's. On a server one process serves
	 * everybody, so a storage built once at module level is one space shared by
	 * every reader at the same time. That is right for a cache and wrong for
	 * anything a single user owns — and the two look identical until the day two
	 * requests arrive together.
	 *
	 * Both shapes are here because the difference is the whole rule: a namespace
	 * per request, or a key that carries whose it is.
	 */
	it("leaks between requests when they share one namespace", async () => {
		// The module-level storage, with the key naming only the resource.
		const shared = createLankaUnstorageAdapter(engineOf());

		await shared.setItem("draft/7", "written while serving Ada");
		const servingGrace = await shared.getItem("draft/7");

		// Not a bug in the adapter — it did exactly what it was told. The bug is
		// the key, which says which draft and not whose.
		expect(servingGrace, "what the second request sees").toBe("written while serving Ada");
	});

	it("keeps requests apart when each has its own storage", async () => {
		const perRequest = () => createLankaUnstorageAdapter(engineOf());

		const ada = perRequest();
		const grace = perRequest();

		await ada.setItem("draft/7", "Ada's");

		expect(await grace.getItem("draft/7")).toBeNull();
		expect(await ada.getItem("draft/7")).toBe("Ada's");
	});

	it("keeps them apart in one shared engine when the key says whose it is", async () => {
		// The other legitimate shape, and the one a Redis actually wants: one
		// connection, and a namespace inside the key.
		const engine = engineOf();
		const store = createLankaUnstorageAdapter(engine);

		await store.setItem("users/ada/draft/7", "Ada's");
		await store.setItem("users/grace/draft/7", "Grace's");

		expect(await store.getItem("users/ada/draft/7")).toBe("Ada's");
		expect(await store.getItem("users/grace/draft/7")).toBe("Grace's");
		expect((await store.keys()).sort(), "and both are listable as written").toEqual([
			"users/ada/draft/7",
			"users/grace/draft/7",
		]);
	});

	it("does not let one request's sign-out empty another's space", async () => {
		const engine = engineOf();
		const ada = createLankaUnstorageAdapter(engine);
		const grace = createLankaUnstorageAdapter(engine);

		await ada.setItem("users/ada/draft/7", "Ada's");
		await grace.setItem("users/grace/draft/7", "Grace's");

		// `clear()` is the port's whole-namespace wipe, and over a SHARED engine the
		// namespace is everybody's. This is the second half of the rule: a shared
		// engine means removing by key, never clearing.
		await ada.removeItem("users/ada/draft/7");

		expect(await grace.getItem("users/grace/draft/7"), "the other request's draft").toBe(
			"Grace's",
		);
	});
});
