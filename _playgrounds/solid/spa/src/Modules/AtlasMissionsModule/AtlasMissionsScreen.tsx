import { For, Show, onMount } from "solid-js";
import { atlasAvatarUrl, atlasQueuedCount } from "@lanka-playgrounds/_shared";
import { useLankaVM } from "@lankajs/solid";
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

	/**
	 * The SELECTED read, which is the second thing every binding publishes and
	 * the one no application here used. Tracking is bypassed: this value moves
	 * when the NUMBER moves and not when the board does, so filtering the list
	 * down to one row leaves it alone while the rows above it all change.
	 *
	 * Beside the tracked read rather than instead of it, deliberately — a screen
	 * reads what it renders, and the two overloads exist because those are two
	 * different questions.
	 *
	 * An ACCESSOR, which is Solid's one shape for a reactive value: `queued()`
	 * wherever it is read, including inside the markup, where calling it is what
	 * makes the text node depend on it.
	 */
	const queued = useLankaVM(props.missionsVM, atlasQueuedCount);

	onMount(() => {
		void missions().fetchMissions();
	});

	/*
	 * No `onCleanup(() => missions.stop())`, and that is the correction rather
	 * than an omission. `useLankaVM` registers `onCleanup(stop)` itself whenever
	 * it has an owner, which inside a component it always does — so a screen
	 * releasing as well released TWICE, and the playground's own leak scene is
	 * what said so, by counting one more unsubscribe than subscribe.
	 *
	 * It was harmless, because a second release is ignored. It was also the shape
	 * a reader copies, and the published `stop` exists for the other case: a read
	 * started OUTSIDE a component or a root, where there is no owner and nothing
	 * would ever call it.
	 */
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
				<span data-testid="queued-count">{queued()} queued</span>
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
							<span data-testid={`status-${row.id}`}>{row.status}</span>
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
