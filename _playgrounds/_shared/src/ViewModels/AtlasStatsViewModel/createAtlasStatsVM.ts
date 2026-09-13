import { createStatelessLankaVM } from "lanka/viewmodel";
import type { IAtlasMission } from "../../Core/Interfaces/IAtlasMission";

/** Questions about data somebody else owns. */
export interface IAtlasStatsActions {
	countByStatus: (missions: readonly IAtlasMission[], status: IAtlasMission["status"]) => number;
	mostUrgent: (missions: readonly IAtlasMission[]) => IAtlasMission | null;
	unassigned: (missions: readonly IAtlasMission[]) => readonly IAtlasMission[];
}

/**
 * Statistics: no state at all, and that is the point.
 *
 * Roughly half the ViewModels an application writes hold nothing — they answer
 * questions about data somebody else owns. Given a store they would make every
 * consumer re-render on changes to a state that cannot change, which is a cost
 * paid for a feature nobody used.
 */
export const createAtlasStatsVM = () =>
	createStatelessLankaVM<IAtlasStatsActions>({
		name: "AtlasStatsVM",
		createActions: () => ({
			countByStatus: (missions, status) =>
				missions.filter((mission) => mission.status === status).length,

			mostUrgent: (missions) =>
				missions.reduce<IAtlasMission | null>(
					(best, mission) =>
						best === null || mission.priority < best.priority ? mission : best,
					null,
				),

			unassigned: (missions) => missions.filter((mission) => mission.crewId === null),
		}),
	});
