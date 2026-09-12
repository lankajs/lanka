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

	it("is the same adapter whichever style built it", () => {
		expect(createLankaUnstorageAdapter(engineOf())).toBeInstanceOf(LankaUnstorageAdapter);
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
