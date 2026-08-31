import { afterEach, beforeEach, vi } from "vitest";

/**
 * The registry is resolved LAZILY, inside the hook, out of necessity.
 *
 * A setup file runs BEFORE the test file's body, that is before the test's
 * hoisted `vi.mock` calls are registered. Anything the setup imports at top
 * level is evaluated against the real dependencies, and a mock declared by the
 * test never reaches it.
 *
 * Importing the `lanka/scenario` barrel at top level pulls the whole subsystem
 * into every test's graph — `ALankaScenario`, `lankaEventBus`,
 * `LankaScenarioBootstrap` — and any test legitimately mocking the bus stops
 * working, because `ALankaScenario` is already bound to the real one.
 *
 * The failure is silent: not an import error but "the spy was called 0 times".
 */
const resetScenarioRegistry = async (): Promise<void> => {
	const { resetLanka } = await import("./resetLanka");
	resetLanka();
};

/**
 * The one setup file every `lanka` consumer loads, and the framework's own.
 *
 * It lives in the PACKAGE because everything it resets belongs to the framework:
 * the scenario registry, fake timers, mock state, the RTL DOM. A consumer wires
 * it with one line in `setupFiles` and gets exactly what the framework's own
 * suite runs against. The alternative is a copy per consumer, and a copy is
 * where one of them quietly stops resetting the registry.
 *
 * The `node` project has no `window`, so everything DOM-shaped is behind a
 * capability check and React Testing Library is imported dynamically. A second
 * setup file would be worse: the timer and scenario resets below are why the
 * suite does not cascade after a timeout, and two copies is exactly the shape
 * where one stops matching the other.
 */

const HAS_DOM = typeof window !== "undefined";

const makeStorage = () => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		get length() {
			return Object.keys(store).length;
		},
		key: (i: number) => Object.keys(store)[i] ?? null,
	};
};

if (HAS_DOM) {
	Object.defineProperty(window, "localStorage", { value: makeStorage(), writable: true });
	Object.defineProperty(window, "sessionStorage", { value: makeStorage(), writable: true });
}

/**
 * Resolved once, not per test: `await import(...)` inside `afterEach` would add
 * a module resolution to every case in the suite; here it costs one per file.
 */
const cleanupDom: Promise<() => void> = HAS_DOM
	? import("@testing-library/react").then((rtl) => rtl.cleanup)
	: Promise.resolve(() => {});

beforeEach(async () => {
	// Guard against fake timers leaked by a timed-out test.
	vi.useRealTimers();
	vi.clearAllTimers();
	// Guard against mock state leaking between tests when a local `afterEach`
	// did not clear it, or did not run at all because the test timed out.
	vi.clearAllMocks();
	await resetScenarioRegistry();
});

afterEach(async () => {
	// React Testing Library cleanup, registered globally as a backstop. A local
	// `afterEach(cleanup)` still runs first; this only guarantees the DOM is
	// wiped even when a test times out and skips its own cleanup — the root cause
	// of "found multiple elements" leaks between sibling tests in one file.
	(await cleanupDom)();
	vi.clearAllTimers();
	vi.useRealTimers();
	await resetScenarioRegistry();
});
