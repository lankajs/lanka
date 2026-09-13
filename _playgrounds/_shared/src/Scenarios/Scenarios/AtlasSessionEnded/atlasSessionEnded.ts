import { createLankaScenario } from "lanka/scenario";
import type { TAtlasSessionEndedEventData } from "../../ScenarioTypes/TAtlasSessionEndedEventData";

/**
 * The session is over.
 *
 * Carried as a fact rather than as a function call into each screen, because
 * what it MEANS differs per screen: a list drops its rows, a badge clears, a
 * blob cache empties itself because cached avatars are other people's faces.
 * None of those belong to whoever noticed the token was gone.
 */
export const atlasSessionEnded = createLankaScenario<TAtlasSessionEndedEventData>({
	name: "AtlasSessionEnded",
	eventType: "session.ended",
	dataTypeName: "TAtlasSessionEndedEventData",
});
