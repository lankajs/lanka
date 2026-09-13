import { describe, expect, it } from "vitest";
import { AtlasIdempotency } from "./AtlasIdempotency";

describe("AtlasIdempotency", () => {
	it("does the work once for one key, however many times it is asked", () => {
		const ledger = new AtlasIdempotency<number>();
		let done = 0;

		const first = ledger.once("k1", () => (done += 1));
		const second = ledger.once("k1", () => (done += 1));

		expect(done).toBe(1);
		expect(second).toBe(first);
	});

	it("keeps two keys apart", () => {
		const ledger = new AtlasIdempotency<string>();

		expect(ledger.once("k1", () => "one")).toBe("one");
		expect(ledger.once("k2", () => "two")).toBe("two");
	});

	it("runs every unkeyed request, rather than collapsing them into one answer", () => {
		// Treating an absent key as a key would make every client that sends none
		// share one result — a far worse failure than the one being prevented.
		const ledger = new AtlasIdempotency<number>();
		let done = 0;

		ledger.once(undefined, () => (done += 1));
		ledger.once(undefined, () => (done += 1));

		expect(done).toBe(2);
	});

	it("says which keys it has spent", () => {
		const ledger = new AtlasIdempotency<string>();
		ledger.once("k1", () => "one");

		expect(ledger.knows("k1")).toBe(true);
		expect(ledger.knows("k2")).toBe(false);
	});
});
