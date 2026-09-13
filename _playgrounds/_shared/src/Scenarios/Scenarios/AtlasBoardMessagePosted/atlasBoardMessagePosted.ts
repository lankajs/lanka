import { createLankaScenario } from "lanka/scenario";
import type { TAtlasBoardMessagePostedEventData } from "../../ScenarioTypes/TAtlasBoardMessagePostedEventData";

/** Somebody said something on the dispatch board. */
export const atlasBoardMessagePosted = createLankaScenario<TAtlasBoardMessagePostedEventData>({
	name: "AtlasBoardMessagePosted",
	eventType: "board.said",
	dataTypeName: "TAtlasBoardMessagePostedEventData",
});
