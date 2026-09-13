import type { ILankaPage, ILankaSortState } from "@lankajs/collection";
import type { IAtlasMission } from "./IAtlasMission";

/**
 * What the missions screen can do.
 *
 * The prefixes are the convention `ARCHITECTURE.md` recommends, and the point of
 * them is that a reader knows without opening one whether it hits the network,
 * whether it shows a spinner and whether it writes state:
 *
 * | `fetch…`   | network, spinner, writes state |
 * | `refresh…` | network, SILENT, writes state  |
 * | `apply…`   | no network, writes state       |
 */
export interface IAtlasMissionsActions {
	fetchMissions: () => Promise<void>;
	/** The same read, without a spinner — what a server event asks for. */
	refreshMissions: () => Promise<void>;
	applyMission: (mission: IAtlasMission) => void;
	applySearch: (term: string) => void;
	sortBy: (field: string) => void;
	goToPage: (page: number) => void;
	/** Completes a mission optimistically; a second press supersedes the first. */
	completeMission: (id: string) => Promise<void>;
	/** Removes a mission under a lock, because a delete may not run twice. */
	removeMission: (id: string) => Promise<"done" | "blocked" | "failed">;
	/** The rows as the screen renders them: filtered, sorted, stable, paginated. */
	rows: () => ILankaPage<IAtlasMission>;
	currentSort: () => ILankaSortState;
}
