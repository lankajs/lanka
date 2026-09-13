import type { IAtlasMission } from "../../Core/Interfaces/IAtlasMission";

/**
 * What a completion carries.
 *
 * Its own file rather than a declaration beside the scenario, because it has
 * more than one owner: the scenario declares it, every ViewModel that subscribes
 * reads it, and so does whatever bridge turns a server event into it. A type
 * with two owners lives where both already look.
 *
 * The mission is OPTIONAL because a backend may announce only an id. Triggering
 * with the data when there is data is what keeps one save from becoming N
 * refetches; triggering the bare fact is the honest alternative when the server
 * returned nothing.
 */
export interface TAtlasMissionCompletedEventData {
	id: string;
	mission?: IAtlasMission;
}
