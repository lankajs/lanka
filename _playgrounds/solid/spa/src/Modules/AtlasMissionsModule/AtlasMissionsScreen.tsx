import { For, Show, onCleanup, onMount } from "solid-js";
import { atlasAvatarUrl } from "@lanka-playgrounds/_shared";
import { formatAtlasMissionLine, useAtlasMissions } from "@lanka-playgrounds/solid-shared";
import { AtlasAvatar } from "./AtlasAvatar";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";
import type { TAtlasMissionsVM } from "@lanka-playgrounds/solid-shared";

/** What the missions screen is given. */
export interface IAtlasMissionsScreenProps {
	missionsVM: TAtlasMissionsVM;
	/** The avatar bytes, shared with every other screen that draws a face. */
	avatars: LankaBlobCachePolicy;
}

/**
 * The board, and nothing else.
 *
 * It reads ONE view and owns nothing: no loading flag, no retry, no decision
 * about what a failure means. Every one of those belongs to the ViewModel — the
 * same sentence the React, Vue and Svelte screens carry, about the same
 * ViewModel, with only Solid's syntax between them.
 *
 * `onMount` rather than an effect: the fetch happens ONCE, when the screen
 * exists. In Solid the component body already runs once, so this is belt and
 * braces — but it is the same word the other three screens use, and a reader
 * moving between them should not have to notice.
 *
 * `<Show>` and `<For>` rather than `&&` and `.map()`, which is not decoration.
 * A Solid component runs once: a `.map()` in the body would iterate the list it
 * saw on that single run and never again, and the screen would be frozen with no
 * error anywhere. This is the one place where Solid's syntax is not a preference.
 *
 * The same rule is why the avatar is mounted INSIDE `<For>` and nowhere else.
 * Per-row work in the body would run once, over the list that happened to be
 * there at mount — which here is the empty one — and no row loaded afterwards
 * would ever get a face.
 */
export const AtlasMissionsScreen = (props: IAtlasMissionsScreenProps) => {
	const missions = useAtlasMissions(props.missionsVM);

	onMount(() => {
		void missions().fetchMissions();
	});

	onCleanup(() => {
		missions.stop();
	});

	return (
		<section aria-label="Missions">
			<header>
				<input
					aria-label="Search missions"
					value={missions().search}
					onInput={(event) => missions().applySearch(event.currentTarget.value)}
				/>
				<button type="button" onClick={() => missions().sortBy("priority")}>
					Sort by priority
				</button>
			</header>

			<Show when={missions().error !== null}>
				<p role="alert">{missions().error}</p>
			</Show>
			<Show when={missions().isLoading}>
				<p role="status">Loading the board…</p>
			</Show>

			<ul>
				<For each={missions().rows().items}>
					{(row) => (
						<li>
							{/* `<Show>` and not `&&`: the narrowed id arrives as an accessor, so a
							    row whose crew is null renders no `<img>` at all rather than one
							    pointing at `/api/crew/null/avatar.png`. */}
							<Show when={row.crewId}>
								{(crewId) => (
									<AtlasAvatar
										cache={props.avatars}
										url={atlasAvatarUrl(crewId())}
										name={crewId()}
									/>
								)}
							</Show>
							{formatAtlasMissionLine(row)}
							<button
								type="button"
								// `void`: the action returns a promise and a DOM handler has nowhere to put
								// one. The ViewModel already owns what a failure means, so there is
								// nothing here to await and nothing to catch.
								onClick={() => void missions().completeMission(row.id)}
							>
								Complete {row.code}
							</button>
						</li>
					)}
				</For>
			</ul>

			<footer>
				<button
					type="button"
					disabled={missions().page <= 1}
					onClick={() => missions().goToPage(missions().page - 1)}
				>
					Previous
				</button>
				<span data-testid="page">
					{missions().page} / {missions().rows().totalPages}
				</span>
				<button
					type="button"
					disabled={missions().page >= missions().rows().totalPages}
					onClick={() => missions().goToPage(missions().page + 1)}
				>
					Next
				</button>
			</footer>
		</section>
	);
};
