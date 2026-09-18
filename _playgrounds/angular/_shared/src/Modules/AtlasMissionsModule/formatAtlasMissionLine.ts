import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * One mission, as one line of text.
 *
 * The same rule `@lanka-playgrounds/react-shared` states, in the ecosystem that
 * needs it for the same reason: `{{ row.code }} {{ row.title }}` in a template
 * renders as separate text nodes, which looks identical on screen and means a
 * reader — a test, a screen reader — cannot match the line.
 *
 * A plain function and not a pipe. A pipe is a class with a decorator and an
 * import into every template that uses it; this is a string rule, it is used by
 * a server renderer and a test as well as by a template, and none of those want
 * an injector to call it.
 */
export const formatAtlasMissionLine = (mission: IAtlasMission): string =>
	`${mission.code} ${mission.title}`;
