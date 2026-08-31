import { beforeAll, bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { LankaIdRegistry } from "./LankaIdRegistry";

/**
 * What keeping a set of ids small costs per row.
 *
 * The registry exists because a thousand string ids in storage is what fills a
 * quota; it is paid on every row of every list that remembers something — read
 * marks, favourites, collapsed groups. Encoding a KNOWN id is the common case by
 * far: the first pass over a list mints them, and every pass after that hits the
 * map.
 */
describe("LankaIdRegistry", () => {
	lankaBenchCalibration();

	const registry = new LankaIdRegistry();
	const ids = Array.from({ length: 1000 }, (_, index) => `7f3c-${String(index)}`);

	// Minted once, so the benches below measure a hit rather than a mint.
	beforeAll(async () => {
		await Promise.all(ids.map((id) => registry.encode(id)));
	});

	let cursor = 0;

	bench(
		"encoding an id the registry already knows",
		async () => {
			cursor = (cursor + 1) % ids.length;
			await registry.encode(ids[cursor]);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"decoding back to the id",
		() => {
			cursor = (cursor + 1) % ids.length;
			registry.decode(cursor);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"minting an id nobody has seen",
		async () => {
			cursor += 1;
			await registry.encode(`fresh-${String(cursor)}`);
		},
		LANKA_BENCH_OPTIONS,
	);
});
