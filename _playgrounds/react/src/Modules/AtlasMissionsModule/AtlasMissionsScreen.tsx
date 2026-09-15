import type { ILankaReadableVM } from "lanka/viewmodel";
import { useLankaVM } from "@lankajs/react";
import { useEffect } from "react";
import { AtlasAvatar } from "./AtlasAvatar";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";

/** What the missions screen is given. */
export interface IAtlasMissionsScreenProps {
	missionsVM: ILankaReadableVM<IAtlasMissionsState & IAtlasMissionsActions>;
	avatars: LankaBlobCachePolicy;
}

const AVATAR_URL = (crewId: string): string => `/api/crew/${crewId}/avatar.png`;

/**
 * The board, and nothing else.
 *
 * It reads ONE hook and owns nothing: no loading flag, no retry, no decision
 * about what a failure means. Every one of those belongs to the ViewModel — and
 * a component that reached a gateway directly would take them all on and
 * implement none, which is invisible while the network is fast.
 *
 * The hook re-renders this component only for the keys it actually READ. That is
 * usually free, and it is why the ViewModel's state is flat: `search` moving
 * must not re-render a component that only reads `page`.
 */
export const AtlasMissionsScreen = ({
	missionsVM,
	avatars,
}: IAtlasMissionsScreenProps): JSX.Element => {
	const {
		isLoading,
		error,
		search,
		page,
		fetchMissions,
		applySearch,
		sortBy,
		goToPage,
		rows,
		completeMission,
		removeMission,
	} = useLankaVM(missionsVM);

	useEffect(() => {
		void fetchMissions();
	}, [fetchMissions]);

	const visible = rows();

	return (
		<section aria-label="Missions">
			<header>
				<input
					aria-label="Search missions"
					value={search}
					onChange={(event) => applySearch(event.target.value)}
				/>
				<button type="button" onClick={() => sortBy("priority")}>
					Sort by priority
				</button>
			</header>

			{error !== null && <p role="alert">{error}</p>}
			{isLoading && <p role="status">Loading the board…</p>}

			<ul>
				{visible.items.map((mission) => (
					<li key={mission.id}>
						{mission.crewId !== null && (
							<AtlasAvatar
								cache={avatars}
								url={AVATAR_URL(mission.crewId)}
								name={mission.crewId}
							/>
						)}
						<span>{mission.code}</span> <span>{mission.title}</span>{" "}
						<span data-testid={`status-${mission.id}`}>{mission.status}</span>
						<button type="button" onClick={() => void completeMission(mission.id)}>
							Complete {mission.code}
						</button>
						<button type="button" onClick={() => void removeMission(mission.id)}>
							Remove {mission.code}
						</button>
					</li>
				))}
			</ul>

			<footer>
				<button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
					Previous
				</button>
				<span data-testid="page">
					{page} / {visible.totalPages}
				</span>
				<button
					type="button"
					disabled={page >= visible.totalPages}
					onClick={() => goToPage(page + 1)}
				>
					Next
				</button>
			</footer>
		</section>
	);
};
