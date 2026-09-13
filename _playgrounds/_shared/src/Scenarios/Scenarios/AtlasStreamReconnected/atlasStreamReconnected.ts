import { createLankaScenario } from "lanka/scenario";
import type { TAtlasStreamReconnectedEventData } from "../../ScenarioTypes/TAtlasStreamReconnectedEventData";

/**
 * A connection came back, and there is a gap in what this application was told.
 *
 * A FACT, and therefore a scenario — which is what lets a bridge answer
 * `onReconnect` without reaching into a ViewModel. A bridge that called
 * `missionsVM.refresh()` directly would be a stream package knowing a screen's
 * name, and every new screen that needs to catch up would be an edit to the
 * bridge.
 *
 * Each subscriber decides what the gap means for it: a list refetches, a board
 * asks for its summary again, a screen showing nothing does nothing at all.
 *
 * It is NOT "connected". `onReconnect` never fires on a first connection,
 * because there was no gap: announcing one there would make every screen reload
 * the data it had just loaded.
 */
export const atlasStreamReconnected = createLankaScenario<TAtlasStreamReconnectedEventData>({
	name: "AtlasStreamReconnected",
	eventType: "stream.reconnected",
	dataTypeName: "TAtlasStreamReconnectedEventData",
});
