import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * One mission, as one line of text.
 *
 * `${code} ${title}` was written out at three call sites, each as a template
 * inside JSX, and each with the same comment explaining why it is ONE text node
 * rather than two: `{code} {title}` renders as separate children, which looks
 * identical on screen and means a reader — a test, a screen reader — cannot match
 * the line. Three copies of a rule is a rule nobody owns.
 *
 * Text and not a component, so the device application can use it: a `Text` from
 * React Native and a `<li>` share no renderer, and they do share this.
 */
export const formatAtlasMissionLine = (mission: IAtlasMission): string =>
	`${mission.code} ${mission.title}`;
