/**
 * One file of a consumer's project, as the linter sees it.
 *
 * Paths are relative on purpose: a flat config resolves files against the
 * working directory, and an absolute path outside it matches no configuration at
 * all — which ESLint reports as a WARNING, so a test asserting "no errors" would
 * pass while linting nothing.
 */
export interface IPlaygroundFile {
	filename: string;
	code: string;
}
