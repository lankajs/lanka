import type { IAtlasRoute } from "../../_interfaces/IAtlasRoute";

/** The route that answers, and what its pattern captured. */
export interface IAtlasRouteMatch {
	route: IAtlasRoute;
	params: Record<string, string>;
}

const segmentsOf = (path: string): string[] => path.split("/").filter((part) => part.length > 0);

/**
 * Matches one pattern against one path, answering what it captured.
 *
 * `null` rather than `{}` for "no match": an empty object of captures is what a
 * pattern with no `:name` segments legitimately answers, and a caller that could
 * not tell the two apart would route every request to the first pattern of the
 * right length.
 */
const captures = (pattern: string, path: string): Record<string, string> | null => {
	const wanted = segmentsOf(pattern);
	const given = segmentsOf(path);
	if (wanted.length !== given.length) return null;

	const params: Record<string, string> = {};

	for (const [index, segment] of wanted.entries()) {
		if (segment.startsWith(":")) {
			params[segment.slice(1)] = decodeURIComponent(given[index]);
			continue;
		}
		if (segment !== given[index]) return null;
	}

	return params;
};

/**
 * Finds the route for a request, in the order the table declares.
 *
 * In order, not by specificity: a table whose meaning depends on a sorting rule
 * is a table you cannot read top to bottom. `/missions/legacy` therefore stands
 * ABOVE `/missions/:id`, where a reader can see why.
 */
export const matchAtlasRoute = (
	routes: readonly IAtlasRoute[],
	method: string,
	path: string,
): IAtlasRouteMatch | null => {
	for (const route of routes) {
		if (route.method !== method) continue;

		const params = captures(route.path, path);
		if (params) return { route, params };
	}

	return null;
};
