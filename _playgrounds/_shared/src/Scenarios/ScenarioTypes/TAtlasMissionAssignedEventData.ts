import type { IAtlasMission } from "../../Core/Interfaces/IAtlasMission";

/** What an assignment carries. `crewId` is `null` when a mission was unassigned. */
export interface TAtlasMissionAssignedEventData {
	id: string;
	crewId: string | null;
	mission?: IAtlasMission;
}
