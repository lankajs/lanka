import { afterAll, bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { resetActiveLanka } from "lanka";
import { playgroundOrderResource, startPlaygroundNavigation } from "../../_playground/app";

/**
 * What guessing costs when the guess is wrong.
 *
 * The intent buffer is asked on every hover, every touch-start and every row
 * that scrolls into view — far more often than a navigation actually happens. So
 * the number that matters is the REFUSED one: a warm-up the plugin decides
 * against must cost near nothing, or the prediction is more expensive than the
 * navigation it was trying to save.
 */
describe("lankaPrefetch", () => {
	lankaBenchCalibration();

	const app = startPlaygroundNavigation();

	afterAll(() => {
		app.lanka.dispose();
		resetActiveLanka();
	});

	let id = 0;

	bench(
		"asking for something already warm, which a second hover does",
		() => {
			app.prefetch.intent.lankaPrefetch(playgroundOrderResource, { id: "7" });
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"claiming a warmed resource, which the navigation does once",
		() => {
			void app.prefetch.intent.claim(playgroundOrderResource, { id: "7" });
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"warming a key nobody asked for before",
		() => {
			id += 1;
			app.prefetch.intent.lankaPrefetch(playgroundOrderResource, { id: String(id) });
		},
		LANKA_BENCH_OPTIONS,
	);
});
