/**
 * Which COPIES of the package are on this page, and whether any of them runs.
 *
 * A copy is one evaluation of this module — one bundle's `lanka`. Two instances
 * of one copy are the isolation `createLanka` promises; two copies are what a
 * build produces when separately bundled modules each carry their own `lanka`,
 * and then each copy's pointer knows only its own runtime. A scenario triggered
 * through one never reaches a ViewModel registered with the other, and nothing
 * anywhere reports it.
 *
 * The only place two copies can meet is the global object, under a name every
 * copy agrees on without importing anything: `Symbol.for`.
 *
 * Dependency-free for the same reason `activeRuntime.ts` is — it imports nothing
 * and adds no edge to the module graph. That is also what keeps hot reload from
 * reading as a second copy: an update re-evaluates the edited module and its
 * IMPORTERS, and a module that imports nothing is on no such path unless it is
 * the file being edited. A full reload starts a new global object.
 */

/**
 * One copy, as the others see it: `null` while it has no runtime, otherwise
 * whether that runtime runs in development.
 */
export type TLankaCopyState = () => boolean | null;

const COPIES = Symbol.for("lanka.copies");

const copies = (): Set<TLankaCopyState> => {
	const global = globalThis as Record<symbol, Set<TLankaCopyState> | undefined>;
	return (global[COPIES] ??= new Set<TLankaCopyState>());
};

let thisCopy: TLankaCopyState | null = null;
let warned = false;

const otherCopies = (): TLankaCopyState[] => [...copies()].filter((copy) => copy !== thisCopy);

/** Whether a copy of the package other than this one has a runtime. */
const anotherIsRunning = (): boolean => otherCopies().some((copy) => copy() !== null);

/**
 * Once per copy, and only in development: a production page with two copies may
 * be two isolated applications on purpose, and the reader who can fix a build
 * is the one running it locally.
 */
const warnOnce = (): void => {
	if (warned) return;

	warned = true;
	console.warn(
		"[lanka] two copies of lanka are on this page. Each copy has its own " +
			"runtime, so a scenario triggered through one never reaches a ViewModel " +
			"registered with the other. If the modules on this page are meant to share " +
			"state, ship ONE lanka: a singleton in Module Federation's `shared`, an " +
			"import map, or `lanka` external in every module's build. If they are " +
			"meant to be isolated, this is expected.",
	);
};

/**
 * Puts this copy on the page's list, when the copy LOADS.
 *
 * Loading is the one moment a copy that is never started does anything the page
 * can see — and never starting is the commonest form of the accident: the shell
 * started lanka, a module bundled its own and saw no reason to. Whether to warn
 * is the RUNNING copy's call, since this one has no flags yet.
 */
const join = (state: TLankaCopyState): void => {
	thisCopy = state;
	copies().add(state);

	if (otherCopies().some((copy) => copy() === true)) warnOnce();
};

/**
 * Called on every activation, which is not a hot path: `createLanka`, its
 * `bootstrap`, and one instance per request on a server.
 */
const noteActivation = (isDevelopment: boolean): void => {
	// Re-added, not assumed: whatever cleared the global list — a test between
	// cases — must not make a running copy invisible to the next one.
	if (thisCopy) copies().add(thisCopy);

	if (isDevelopment && anotherIsRunning()) warnOnce();
};

/**
 * The three questions a copy asks of the page, as one table: they share this
 * copy's identity and its one warning, so they are one subject.
 */
export const lankaCopies = Object.freeze({ join, noteActivation, anotherIsRunning });
