import type { ILankaScenario } from "./ILankaScenario";

/**
 * Metadata about a registered scenario
 */
export interface ILankaScenarioMetadata {
	scenario: ILankaScenario<unknown>;
	name: string;
	eventType: string;
	dataTypeName: string;
	isRegistered: boolean;
}
