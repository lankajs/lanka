import { createLankaScenario } from "lanka/scenario";

/** The one fact the shop announces and the header listens for. */
export const playgroundCartChanged = createLankaScenario<{ items: number }>({
	name: "PlaygroundCartChanged",
	eventType: "playground:cart-changed",
	dataTypeName: "IPlaygroundCartChanged",
});
