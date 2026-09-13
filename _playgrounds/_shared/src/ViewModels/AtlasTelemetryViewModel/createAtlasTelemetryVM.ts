import { createLazyLankaVM } from "lanka/viewmodel";
import { readAtlasFailure } from "../../Core/Failures/readAtlasFailure";
import type {
	IAtlasTelemetry,
	IAtlasTelemetryGateway,
} from "../../Gateways/AtlasTelemetryGateway/createAtlasTelemetryGateway";

/** What the telemetry panel holds. */
export interface IAtlasTelemetryState {
	telemetry: IAtlasTelemetry | null;
	error: string | null;
	/** What the server said when it refused on purpose. */
	refusal: string | null;
}

/** What the telemetry panel can do. */
export interface IAtlasTelemetryActions {
	fetchTelemetry: () => Promise<void>;
	/** Asks for something the server refuses, so a refusal can be seen arriving. */
	fetchRestricted: () => Promise<void>;
}

/** What it reaches for. */
export interface IAtlasTelemetryGateways {
	telemetryGateway: IAtlasTelemetryGateway;
}

/**
 * The telemetry panel, built on FIRST USE rather than at module load.
 *
 * Lazy because most sessions never open it, and a ViewModel declared at module
 * level is a store built, and subscribed, whether or not anybody looks at the
 * screen. What comes with that is a duty: `dispose()` when the screen goes, or
 * its scenario subscriptions outlive it and it keeps reacting to facts about a
 * screen nobody is looking at.
 *
 * Lazy is a LIFETIME, not a role, which is why the lazy variants are
 * factory-only: there is nothing extra to subclass.
 */
export const createAtlasTelemetryVM = (telemetryGateway: IAtlasTelemetryGateway) =>
	createLazyLankaVM<IAtlasTelemetryState, IAtlasTelemetryActions, IAtlasTelemetryGateways>({
		name: "AtlasTelemetryVM",
		gateways: () => ({ telemetryGateway }),
		states: { telemetry: null, error: null, refusal: null },

		createActions: ({ set, gateways }) => ({
			fetchTelemetry: async () => {
				try {
					set({ telemetry: await gateways.telemetryGateway.summary(), error: null });
				} catch (failure) {
					set({ error: readAtlasFailure(failure) });
				}
			},

			fetchRestricted: async () => {
				try {
					await gateways.telemetryGateway.restricted();
					set({ refusal: null });
				} catch (failure) {
					// The refusal arrives as a `domain` failure carrying the status
					// NAME — `PERMISSION_DENIED`, not `7` — because a line somebody can
					// read beats a line somebody has to look up.
					set({ refusal: readAtlasFailure(failure) });
				}
			},
		}),
	});
