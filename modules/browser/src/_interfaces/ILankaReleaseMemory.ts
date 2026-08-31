/**
 * Where the last seen version is kept between visits.
 *
 * A port because the answer differs: most applications want `localStorage`,
 * one embedded in a WebView without it wants something else, and a test wants
 * neither.
 */
export interface ILankaReleaseMemory {
	read: () => string | null;
	write: (version: string) => void;
}
