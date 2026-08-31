/**
 * A tsconfig with the mapping the contract requires.
 *
 * The whole failure this package exists to catch is this file being RIGHT while
 * something else is missing, so it is stated once and never edited by a test
 * that means to break something else.
 */
export const PLAYGROUND_TSCONFIG = `{
	"compilerOptions": {
		"paths": {
			"@lanka_di/*": [".lanka_di/*"]
		}
	},
	"include": ["src", ".lanka_di/**/*"]
}
`;
