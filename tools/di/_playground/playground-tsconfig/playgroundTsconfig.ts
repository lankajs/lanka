import type { TLankaDiDirname } from "../../src/index";

/**
 * A tsconfig with the mapping the contract requires, for either directory.
 *
 * The whole failure this package exists to catch is this file being RIGHT while
 * something else is missing, so it is stated once and never edited by a test
 * that means to break something else.
 *
 * It takes the directory rather than naming one, because a project on `.lanka`
 * and a project on `.lanka_di` are both correct and the scenes have to start
 * from either. Two copies of this string would be two places for the mapping to
 * be subtly wrong in one layout and right in the other.
 */
export const playgroundTsconfig = (dirname: TLankaDiDirname): string => `{
	"compilerOptions": {
		"paths": {
			"@lanka_di/*": ["${dirname}/*"]
		}
	},
	"include": ["src", "${dirname}/**/*"]
}
`;
