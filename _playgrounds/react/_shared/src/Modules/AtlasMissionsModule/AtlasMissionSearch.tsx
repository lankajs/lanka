import type { JSX } from "react";

/** What the search box is given: the term, and where a new one goes. */
export interface IAtlasMissionSearchProps {
	search: string;
	onSearch: (term: string) => void;
}

/**
 * The search box, in every DOM application of this ecosystem.
 *
 * Props rather than the ViewModel, deliberately. It is the one piece of this
 * screen with no opinion about where `search` comes from — the browser
 * application puts it inside a `<header>` beside a sort button, the Next page and
 * the Astro island put it above a hydrated list — and a component taking the
 * ViewModel would have decided that for all three.
 *
 * `aria-label` and not a placeholder: a placeholder disappears the moment
 * somebody types, so it names the field for exactly as long as nobody needs the
 * name. It is also what the three applications' tests already match on, and they
 * match on it because that is how a person using a screen reader finds it.
 */
export const AtlasMissionSearch = ({ search, onSearch }: IAtlasMissionSearchProps): JSX.Element => (
	<input
		aria-label="Search missions"
		value={search}
		onChange={(event) => onSearch(event.target.value)}
	/>
);
