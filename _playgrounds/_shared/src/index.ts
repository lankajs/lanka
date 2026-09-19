/**
 * Atlas: the half of the application no host owns.
 *
 * Gateways, scenarios, ViewModels, schemas and the start-up chain. Everything
 * here runs in a browser, on a server and on a device, which is what lets four
 * applications share it — and what makes the part that could NOT be shared
 * visible, because it is what is left in each host's own package.
 *
 * A barrel re-exports and declares nothing.
 */
export { startAtlas } from "./startAtlas";
export { createAtlasHost } from "./Core/Configs/createAtlasHost";
export type { IAtlasApp, IAtlasConfig } from "./startAtlas";

export { AtlasMissionGateway } from "./Gateways/AtlasMissionGateway/AtlasMissionGateway";
export type { TAtlasCallOptions } from "./Gateways/AtlasMissionGateway/AtlasMissionGateway";
export { AtlasSessionGateway } from "./Gateways/AtlasSessionGateway/AtlasSessionGateway";
export { AtlasBoardGateway } from "./Gateways/AtlasBoardGateway/AtlasBoardGateway";
export type { IAtlasBoardSummary } from "./Gateways/AtlasBoardGateway/AtlasBoardGateway";
export { createAtlasCrewGateway } from "./Gateways/AtlasCrewGateway/createAtlasCrewGateway";
export type { IAtlasCrewGateway } from "./Gateways/AtlasCrewGateway/createAtlasCrewGateway";
export { createAtlasTelemetryGateway } from "./Gateways/AtlasTelemetryGateway/createAtlasTelemetryGateway";
export type {
	IAtlasTelemetry,
	IAtlasTelemetryGateway,
} from "./Gateways/AtlasTelemetryGateway/createAtlasTelemetryGateway";

export { AtlasMissionCompleted } from "./Scenarios/Scenarios/AtlasMissionCompleted/AtlasMissionCompleted";
export { atlasMissionCompleted } from "./Scenarios/Scenarios/AtlasMissionCompleted/AtlasMissionCompleted";
export type { TAtlasMissionCompletedEventData } from "./Scenarios/ScenarioTypes/TAtlasMissionCompletedEventData";
export { atlasMissionAssigned } from "./Scenarios/Scenarios/AtlasMissionAssigned/atlasMissionAssigned";
export type { TAtlasMissionAssignedEventData } from "./Scenarios/ScenarioTypes/TAtlasMissionAssignedEventData";
export { atlasBoardMessagePosted } from "./Scenarios/Scenarios/AtlasBoardMessagePosted/atlasBoardMessagePosted";
export type { TAtlasBoardMessagePostedEventData } from "./Scenarios/ScenarioTypes/TAtlasBoardMessagePostedEventData";
export { atlasSessionEnded } from "./Scenarios/Scenarios/AtlasSessionEnded/atlasSessionEnded";
export type { TAtlasSessionEndedEventData } from "./Scenarios/ScenarioTypes/TAtlasSessionEndedEventData";
export { atlasStreamReconnected } from "./Scenarios/Scenarios/AtlasStreamReconnected/atlasStreamReconnected";
export type { TAtlasStreamReconnectedEventData } from "./Scenarios/ScenarioTypes/TAtlasStreamReconnectedEventData";

export { AtlasSession } from "./Core/Singletons/AtlasSession/AtlasSession";
export { AtlasClock } from "./Core/Singletons/AtlasClock/AtlasClock";
export type { IAtlasClock } from "./Core/Singletons/AtlasClock/AtlasClock";

export { AtlasDispatchDraftStore } from "./Core/SharedStores/AtlasDispatchDraftStore/AtlasDispatchDraftStore";
export type { IAtlasDispatchDraft } from "./Core/SharedStores/AtlasDispatchDraftStore/AtlasDispatchDraftStore";

export { createAtlasMissionsVM } from "./ViewModels/AtlasMissionsViewModel/createAtlasMissionsVM";
export type { IAtlasMissionGateways } from "./ViewModels/AtlasMissionsViewModel/createAtlasMissionsVM";
export { AtlasBoardVM } from "./ViewModels/AtlasBoardViewModel/AtlasBoardVM";
export type {
	IAtlasBoardActions,
	IAtlasBoardGateways,
	IAtlasBoardState,
} from "./ViewModels/AtlasBoardViewModel/AtlasBoardVM";
export { createAtlasMissionEditVM } from "./ViewModels/AtlasMissionEditViewModel/createAtlasMissionEditVM";
export type {
	IAtlasMissionEditActions,
	IAtlasMissionEditGateways,
	IAtlasMissionEditState,
} from "./ViewModels/AtlasMissionEditViewModel/createAtlasMissionEditVM";
export { AtlasDispatchStepVM } from "./ViewModels/AtlasDispatchStepViewModel/AtlasDispatchStepVM";
export type { IAtlasDispatchStepActions } from "./ViewModels/AtlasDispatchStepViewModel/AtlasDispatchStepVM";
export { createAtlasCrewStepVM } from "./ViewModels/AtlasCrewStepViewModel/createAtlasCrewStepVM";
export type { IAtlasCrewStepActions } from "./ViewModels/AtlasCrewStepViewModel/createAtlasCrewStepVM";
export { createAtlasStatsVM } from "./ViewModels/AtlasStatsViewModel/createAtlasStatsVM";
export type { IAtlasStatsActions } from "./ViewModels/AtlasStatsViewModel/createAtlasStatsVM";
export { createAtlasTelemetryVM } from "./ViewModels/AtlasTelemetryViewModel/createAtlasTelemetryVM";
export type {
	IAtlasTelemetryActions,
	IAtlasTelemetryGateways,
	IAtlasTelemetryState,
} from "./ViewModels/AtlasTelemetryViewModel/createAtlasTelemetryVM";

export { AtlasPreferences } from "./Core/Services/AtlasPreferences";
export type { IAtlasPreferences } from "./Core/Services/AtlasPreferences";
export { createAtlasReleaseGuard } from "./Core/Services/createAtlasReleaseGuard";
export { atlasAvatarSrc } from "./Core/Caches/atlasAvatarSrc";
export { atlasAvatarUrl } from "./Core/Caches/atlasAvatarUrl";
export { createAtlasAvatarCache } from "./Core/Caches/createAtlasAvatarCache";
export { readAtlasFailure } from "./Core/Failures/readAtlasFailure";
export { sortAtlasSubmitFailure } from "./Core/Failures/sortAtlasSubmitFailure";
export type { TAtlasSubmitOutcome } from "./Core/Failures/sortAtlasSubmitFailure";
export { replaceAtlasMission } from "./ViewModels/AtlasMissionsViewModel/_Services/replaceAtlasMission";

export { atlasValidator } from "./Core/Validation/atlasValidator";
export { atlasMissionSchema } from "./Core/Validation/atlasMissionSchema";
export { atlasMissionInputSchema } from "./Core/Validation/atlasMissionInputSchema";
export { atlasMissionWireSchema } from "./Core/Validation/atlasMissionWireSchema";
export { atlasCrewSchema } from "./Core/Validation/atlasCrewSchema";
export { atlasSessionSchema } from "./Core/Validation/atlasSessionSchema";
export { atlasBoardSchema } from "./Core/Validation/atlasBoardSchema";
export { atlasTelemetrySchema } from "./Core/Validation/atlasTelemetrySchema";

export type { IAtlasCrewMember } from "./Core/Interfaces/IAtlasCrewMember";
export type { IAtlasMission, TAtlasMissionStatus } from "./Core/Interfaces/IAtlasMission";
export type { IAtlasMissionInput } from "./Core/Interfaces/IAtlasMissionInput";
export type { IAtlasMissionsActions } from "./Core/Interfaces/IAtlasMissionsActions";
export type { IAtlasMissionsState } from "./Core/Interfaces/IAtlasMissionsState";
export type { IAtlasCredentials } from "./Core/Interfaces/IAtlasCredentials";
