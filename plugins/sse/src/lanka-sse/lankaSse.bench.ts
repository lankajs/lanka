import { afterAll, bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { resetActiveLanka } from "lanka";
import { startPlaygroundChat } from "../../_playground/app";

/**
 * What one message from the server costs before anything is rendered.
 *
 * A chat, a live list, a status ticker: the server sets the rate, and the
 * application has no say in it. Everything from the raw event to the scenario
 * trigger runs per message — the bridge's dispatch, the JSON parse, the "from
 * outside" marking that stops an echo going back out.
 */
describe("lankaSse", () => {
	lankaBenchCalibration();

	// One connection for the file: opening one is a sign-in, not a message.
	const app = startPlaygroundChat();
	app.signIn();

	afterAll(() => {
		app.lanka.dispose();
		resetActiveLanka();
	});

	let index = 0;

	bench(
		"a message arriving, from raw event to scenario",
		() => {
			index += 1;
			app.connection().deliver("message", { text: `hello ${String(index)}` });
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"an event type nobody subscribed to",
		() => {
			app.connection().deliver("nobody-listens", { text: "ignored" });
		},
		LANKA_BENCH_OPTIONS,
	);
});
