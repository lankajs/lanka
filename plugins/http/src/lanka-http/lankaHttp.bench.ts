import { afterAll, bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { resetActiveLanka } from "lanka";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import {
	createPlaygroundScript,
	createPlaygroundTransport,
	PlaygroundOrderGateway,
	startPlaygroundHttp,
} from "../../_playground/app";

/**
 * What the plugin adds to a request that succeeds.
 *
 * Six middlewares run in a fixed order on EVERY call: session, csrf, idempotency,
 * timeout, retry, errors. None of them does I/O on the happy path, so what is
 * measured here is the cost of the chain itself — the part paid by every request
 * the application ever makes, including the ones that need none of it.
 *
 * The transport is the playground's, which answers from a script: the number is
 * the framework's share and not the network's.
 */
describe("lankaHttp", () => {
	lankaBenchCalibration();

	// One instance for the whole file: the plugin is installed once per
	// application, and installing it per iteration would measure bootstrap.
	const script = createPlaygroundScript(Array.from({ length: 200_000 }, () => 200));
	const app = startPlaygroundHttp(script);

	afterAll(() => {
		app.lanka.dispose();
		resetActiveLanka();
	});

	// The same request with no plugin installed: the difference between the two
	// is what the six middlewares cost, and the rest is the framework's own
	// request path — which this package cannot change.
	const bare = createLanka({ host: lankaTestHost });
	const bareGateway = new PlaygroundOrderGateway(
		createPlaygroundTransport(
			createPlaygroundScript(Array.from({ length: 200_000 }, () => 200)),
		),
	);

	bench(
		"the same safe request with no plugin installed",
		async () => {
			bare.activate();
			await bareGateway.read();
			app.lanka.activate();
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a safe request through the whole middleware chain",
		async () => {
			script.seen.length = 0;
			await app.gateway.read();
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"an unsafe one, which adds csrf and idempotency to the same chain",
		async () => {
			script.seen.length = 0;
			await app.gateway.place();
		},
		LANKA_BENCH_OPTIONS,
	);
});
