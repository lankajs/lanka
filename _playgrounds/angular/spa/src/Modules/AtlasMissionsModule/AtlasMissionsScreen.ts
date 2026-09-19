import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import {
	ATLAS_MISSIONS_VM,
	formatAtlasMissionLine,
	useAtlasMissions,
} from "@lanka-playgrounds/angular-shared";
import { atlasAvatarUrl } from "@lanka-playgrounds/_shared";
import { AtlasAvatar } from "./AtlasAvatar";

/**
 * The board, and nothing else.
 *
 * It reads ONE view and owns nothing: no loading flag, no retry, no decision
 * about what a failure means. Every one of those belongs to the ViewModel — the
 * same sentence the React, Vue, Svelte and Solid screens carry, about the same
 * ViewModel, with only Angular's syntax between them.
 *
 * `ChangeDetectionStrategy.OnPush`, which under zoneless is not an optimisation
 * but the only strategy there is: what marks this view dirty is the signal the
 * binding writes, and nothing else ever will.
 *
 * `inject(ATLAS_MISSIONS_VM)` in a field initialiser rather than an `input`: a
 * ViewModel is a DEPENDENCY, not data a parent changes, and `useLankaVM` must
 * run in an injection context because `DestroyRef` is what ends its
 * subscription. `../../../_shared` states the case at length.
 */
@Component({
	selector: "atlas-missions-screen",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AtlasAvatar],
	template: `
		<section aria-label="Missions">
			<header>
				<input
					aria-label="Search missions"
					[value]="missions().search"
					(input)="missions().applySearch($any($event.target).value)"
				/>
				<button type="button" (click)="missions().sortBy('priority')">
					Sort by priority
				</button>
			</header>

			@if (missions().error !== null) {
				<p role="alert">{{ missions().error }}</p>
			}
			@if (missions().isLoading) {
				<p role="status">Loading the board…</p>
			}

			<ul>
				@for (row of missions().rows().items; track row.id) {
					<li>
						@if (row.crewId; as crewId) {
							<atlas-avatar [url]="avatarUrl(crewId)" [name]="crewId" />
						}
						{{ line(row) }}
						<span [attr.data-testid]="'status-' + row.id">{{ row.status }}</span>
						<button type="button" (click)="complete(row.id)">
							Complete {{ row.code }}
						</button>
					</li>
				}
			</ul>

			<footer>
				<button
					type="button"
					[disabled]="missions().page <= 1"
					(click)="missions().goToPage(missions().page - 1)"
				>
					Previous
				</button>
				<span data-testid="page"
					>{{ missions().page }} / {{ missions().rows().totalPages }}</span
				>
				<button
					type="button"
					[disabled]="missions().page >= missions().rows().totalPages"
					(click)="missions().goToPage(missions().page + 1)"
				>
					Next
				</button>
			</footer>
		</section>
	`,
})
export class AtlasMissionsScreen implements OnInit {
	readonly missions = useAtlasMissions(inject(ATLAS_MISSIONS_VM));

	readonly line = formatAtlasMissionLine;

	/**
	 * Where a crew member's face lives, as the shared rule spells it.
	 *
	 * Held as a field for the reason `line` is: a template can only call what the
	 * component exposes. Writing the path into the template instead would be a
	 * sixth spelling of an address the cache keys on — and two spellings are two
	 * caches, each holding half the crew.
	 *
	 * The `@if (row.crewId; as crewId)` above is Angular's narrowing form, not a
	 * convenience: `crewId` is `string | null`, and a `!` in the template would be
	 * an assertion where the framework is offering a fact.
	 */
	readonly avatarUrl = atlasAvatarUrl;

	/**
	 * The fetch happens ONCE, when the screen exists.
	 *
	 * `ngOnInit` and not the field initialiser above: a constructor that starts a
	 * request makes the component impossible to construct without one, which is
	 * what every other screen in this folder avoids by using its framework's mount
	 * hook. `void` because the hook cannot await — the ViewModel already owns what
	 * a failure means.
	 */
	ngOnInit(): void {
		void this.missions().fetchMissions();
	}

	/**
	 * A method and not an inline expression, because the action returns a promise.
	 *
	 * A template expression has nowhere to put one, and the ViewModel already owns
	 * what a failure means — so there is nothing here to await and nothing to
	 * catch.
	 */
	complete(id: string): void {
		void this.missions().completeMission(id);
	}
}
