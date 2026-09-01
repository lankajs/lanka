import { createLanka } from "lanka";
import { lankaPrefetch } from "../../src/index";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createPlaygroundRouteSource } from "../create-playground-route-source/createPlaygroundRouteSource";
import { createPlaygroundScheduler } from "../create-playground-scheduler/createPlaygroundScheduler";
import { lankaRouterChunkSource } from "../../src/lanka-router-chunk-source/lankaRouterChunkSource";
import type { IPlaygroundNavigation } from "../_interfaces/IPlaygroundNavigation";

/**
 * A navigation the user has not committed to yet.
 *
 * The package is one rule — a ladder — and a ladder is only observable with
 * every rung present:
 *
 *     SSE  >  ordinary request  >  route chunk  >  data warm-up  >  intent
 *
 * Speculative work stands down while real work is on the wire. The failure it
 * prevents is the one nobody reports as a bug: a screen that loads slowly
 * because the framework was busy fetching something the user never asked for.
 */
export const startPlaygroundNavigation = (): IPlaygroundNavigation => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	const { scheduler, runQueued } = createPlaygroundScheduler();
	const { source, pulled } = createPlaygroundRouteSource();

	const prefetch = lankaPrefetch({
		chunk: {
			thingMs: 0,
			// The default ceiling, deliberately: the harness waits a quarter of a
			// second for a sweep, and a ceiling near that would let a slow machine
			// release a blocked sweep and report the gate as broken.
			quietWireTimeoutMs: 3000,
			scheduler,
			network: { saveData: () => false },
			visibility: { isVisible: () => true, onChange: () => () => undefined },
		},
	});

	lanka.use(prefetch);
	// Through the router binding rather than by hand: an application already has
	// this list, and the shape it passes is the one every popular router exposes.
	prefetch.chunk.setSource(lankaRouterChunkSource(source));

	return {
		lanka,
		prefetch,
		pulled,
		beginRealRequest() {
			lanka.inFlight.begin();
			return () => {
				lanka.inFlight.end();
			};
		},
		// Finished means a chunk was pulled; a blocked sweep never reports one and
		// spends the whole budget, which is exactly what the assertion is about.
		sweep: () => runQueued(() => pulled.length > 0),
	};
};
