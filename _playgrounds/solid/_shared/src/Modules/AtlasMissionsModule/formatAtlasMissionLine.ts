import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * One mission, as one line of text.
 *
 * The same rule `@lanka-playgrounds/react-shared` states, in the ecosystem that
 * needs it for the same reason: `{row.code} {row.title}` in JSX renders as
 * separate text nodes, which looks identical on screen and means a reader — a
 * test, a screen reader — cannot match the line.
 *
 * Text and not a component, so it works wherever Solid does.
 */
export const formatAtlasMissionLine = (mission: IAtlasMission): string =>
	`${mission.code} ${mission.title}`;
