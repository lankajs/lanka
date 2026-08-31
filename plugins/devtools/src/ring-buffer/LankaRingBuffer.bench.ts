import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { LankaRingBuffer } from "./LankaRingBuffer";

/**
 * What the inspector costs the application it is inspecting.
 *
 * Every scenario, every request and every log line reaches this buffer while
 * devtools are on, and by definition it spends its life FULL: the interesting
 * number is the push that has to make room, not the first five hundred.
 */
describe("LankaRingBuffer", () => {
	lankaBenchCalibration();

	const full = new LankaRingBuffer<number>(500);
	for (let index = 0; index < 500; index += 1) full.push(index);

	const roomy = new LankaRingBuffer<number>(2_000_000);

	let tick = 0;

	bench(
		"a push into a full buffer, which is every push after the first 500",
		() => {
			tick += 1;
			full.push(tick);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a push with room to spare",
		() => {
			tick += 1;
			roomy.push(tick);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"reading the buffer out, which the panel does per render",
		() => {
			full.toArray();
		},
		LANKA_BENCH_OPTIONS,
	);
});
