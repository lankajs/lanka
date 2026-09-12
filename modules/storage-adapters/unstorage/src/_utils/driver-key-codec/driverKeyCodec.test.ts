import { describe, expect, it } from "vitest";
import { createStorage } from "unstorage";
import { fromDriverKey, toDriverKey } from "./driverKeyCodec";

/**
 * The codec, checked against the library it exists because of.
 *
 * The other three members double their engine because a native module cannot run
 * here. unstorage can, so this spec asserts the MEASUREMENT rather than a belief
 * about it: the three characters are escaped because the library was observed
 * mangling them, and if a release stopped mangling them this file would still
 * pass while the table in `driverKeyCodec` quietly went stale — so the second
 * test watches the library too.
 */
describe("driverKeyCodec", () => {
	const KEYS = [
		"session.token",
		"with space",
		"with/slash",
		"with\\backslash",
		"with?query=1",
		"with:colon",
		"double::colon",
		"with~tilde",
		"UPPER_and_lower",
		"naïve-café",
		"",
	];

	it("gives back exactly what it was handed", () => {
		for (const key of KEYS) {
			expect(fromDriverKey(toDriverKey(key)), key).toBe(key);
		}
	});

	it("survives unstorage's own normalisation, which is the whole point", async () => {
		const engine = createStorage();

		for (const key of KEYS) await engine.setItemRaw(toDriverKey(key), "v");

		expect([...(await engine.getKeys())].map(fromDriverKey).sort()).toEqual([...KEYS].sort());
	});

	it("names the characters the library actually mangles, and no more", async () => {
		// Written RAW, without the codec: this is the measurement the codec's table
		// states, re-taken on every run so the table cannot go quietly stale.
		const answeredFor = async (key: string) => {
			const engine = createStorage();
			await engine.setItemRaw(key, "v");
			const [answered] = await engine.getKeys();
			return answered;
		};

		expect(await answeredFor("a/b"), "a slash becomes the separator").toBe("a:b");
		expect(await answeredFor("a\\b"), "and so does a backslash").toBe("a:b");
		expect(await answeredFor("a?b"), "a question mark takes the rest with it").toBe("a");

		for (const key of ["a~b", "a_b", "a b", "a.b", "a%b", "a#b", "a-b"]) {
			expect(await answeredFor(key), key).toBe(key);
		}
	});

	it("keeps two keys apart that the library would have made one row", async () => {
		const engine = createStorage();

		// `a::b` and `a:b` are ONE row to unstorage, and the second write wins. An
		// application holding both is the failure this escape prevents.
		await engine.setItemRaw(toDriverKey("a::b"), "first");
		await engine.setItemRaw(toDriverKey("a:b"), "second");

		expect(await engine.getItemRaw(toDriverKey("a::b"))).toBe("first");
		expect(await engine.getItemRaw(toDriverKey("a:b"))).toBe("second");
	});

	it("leaves an ordinary key untouched, so a driver stays readable", () => {
		expect(toDriverKey("session.token")).toBe("session.token");
		expect(toDriverKey("preferences_theme")).toBe("preferences_theme");
	});

	it("escapes the escape, or a literal tilde would decode as something else", () => {
		expect(toDriverKey("~002f")).not.toBe(toDriverKey("/"));
		expect(fromDriverKey(toDriverKey("~002f"))).toBe("~002f");
	});
});
