import { createLankaVM } from "lanka/viewmodel";
import { atlasMissionCompleted } from "../../Scenarios/Scenarios/AtlasMissionCompleted/AtlasMissionCompleted";
import { readAtlasFailure } from "../../Core/Failures/readAtlasFailure";
import { sortAtlasSubmitFailure } from "../../Core/Failures/sortAtlasSubmitFailure";
import type { AtlasMissionGateway } from "../../Gateways/AtlasMissionGateway/AtlasMissionGateway";
import type { IAtlasMission } from "../../Core/Interfaces/IAtlasMission";
import type { TAtlasMissionCompletedEventData } from "../../Scenarios/ScenarioTypes/TAtlasMissionCompletedEventData";
import type { IAtlasMissionInput } from "../../Core/Interfaces/IAtlasMissionInput";
import type { TAtlasSubmitOutcome } from "../../Core/Failures/sortAtlasSubmitFailure";

/**
 * What the edit screen holds.
 *
 * Note what is NOT here: the field values. They belong to whatever owns the
 * inputs — a form library, or `useState` in the component — and the ViewModel
 * keeps the server's version instead. Under server rendering that is not a
 * preference but a requirement: a ViewModel is a store created at module level,
 * which on a server is one store shared by every request.
 */
export interface IAtlasMissionEditState {
	/** The server's version of this mission: the form's `defaultValues`. */
	server: IAtlasMission | null;
	/** Set when somebody ELSE changed it while this form was open. */
	serverChangedAt: string | null;
	isSubmitting: boolean;
	/** A failure with no address: the screen's, not an input's. */
	screenError: string | null;
}

/** What the edit screen can do. */
export interface IAtlasMissionEditActions {
	fetchMission: (id: string) => Promise<void>;
	submit: (values: IAtlasMissionInput) => Promise<TAtlasSubmitOutcome<IAtlasMission>>;
	/** Takes the newer version the screen offered to load. */
	applyServerVersion: () => void;
}

/** What it reaches for. */
export interface IAtlasMissionEditGateways {
	missionGateway: AtlasMissionGateway;
}

/**
 * One mission being edited, and the boundary between a form and the framework.
 *
 * Three rules are written into this file, and each of them is a defect
 * somewhere else when it is broken:
 *
 * - **A scenario handler never touches the fields.** It replaces the server's
 *   version and MARKS it, and the screen then offers "this changed — reload".
 *   Resetting the form automatically erases what somebody is typing; ignoring
 *   the change hands them a conflict on save.
 * - **Own writes are marked before they are announced.** `set` then `trigger`,
 *   so a handler hearing its own save recognises it — compared by id and version,
 *   never by reference.
 * - **The form never sees a `LankaError`.** It does not know what a transport
 *   is; it is handed an outcome with the addresses already read off.
 */
export const createAtlasMissionEditVM = (missionGateway: AtlasMissionGateway) =>
	createLankaVM<IAtlasMissionEditState, IAtlasMissionEditActions, IAtlasMissionEditGateways>({
		name: "AtlasMissionEditVM",
		gateways: () => ({ missionGateway }),
		states: { server: null, serverChangedAt: null, isSubmitting: false, screenError: null },

		createActions: ({ set, get, gateways, trigger }) => ({
			fetchMission: async (id) => {
				try {
					set({ server: await gateways.missionGateway.byId(id), serverChangedAt: null });
				} catch (failure) {
					set({ screenError: readAtlasFailure(failure) });
				}
			},

			submit: async (values) => {
				set({ isSubmitting: true, screenError: null });
				try {
					const saved = await gateways.missionGateway.rename(
						get().server?.id ?? "",
						values.title,
					);

					// 1. mark our own write, 2. announce it WITH the data.
					set({ server: saved, serverChangedAt: null });
					trigger(atlasMissionCompleted, { id: saved.id, mission: saved });

					return { ok: true, data: saved };
				} catch (failure) {
					return sortAtlasSubmitFailure(failure, (message) =>
						set({ screenError: message }),
					);
				} finally {
					// The form is still mounted here; navigation happens after this
					// returns, so there is something alive to be told.
					set({ isSubmitting: false });
				}
			},

			applyServerVersion: () => {
				set({ serverChangedAt: null });
			},
		}),

		scenarioHandlers: [
			{
				scenario: atlasMissionCompleted,
				handler:
					({ get, set }) =>
					(data?: TAtlasMissionCompletedEventData) => {
						const mission = data?.mission;
						if (!mission) return;

						const current = get().server;
						// By id AND version, never by reference: the object that arrives
						// over a wire is a different object from the one we saved.
						if (!current || current.id !== mission.id) return;
						if (current.updatedAt === mission.updatedAt) return;

						set({ server: mission, serverChangedAt: mission.updatedAt });
					},
			},
		],
	});
