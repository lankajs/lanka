import { createLankaScenario } from "lanka/scenario";
import type { TAtlasMissionAssignedEventData } from "../../ScenarioTypes/TAtlasMissionAssignedEventData";

/**
 * A mission changed hands — written by calling, which is what most scenarios are.
 *
 * A scenario's body is almost always only data, and then the class adds a
 * `readonly` line per field and nothing else. The class style earns its place
 * when the scenario has behaviour of its own.
 */
export const atlasMissionAssigned = createLankaScenario<TAtlasMissionAssignedEventData>({
	name: "AtlasMissionAssigned",
	eventType: "mission.assigned",
	dataTypeName: "TAtlasMissionAssignedEventData",
});
