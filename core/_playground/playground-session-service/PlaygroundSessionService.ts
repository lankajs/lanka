import { ALankaSingleton } from "../../src/locator/index";

/**
 * A service the application publishes to the locator.
 *
 * It extends the marker rather than being registered by shape: without one, the
 * selection is "anything that is a function with a prototype", and a stray
 * export in a barrel silently becomes part of the public `lankaSingletons.*`.
 *
 * Nothing above it constructs one. That is the point of the layer: a screen asks
 * for `playgroundSessionService` and never learns where it came from, which is
 * what makes it replaceable in a test and in an application that wants its own.
 */
export class PlaygroundSessionService extends ALankaSingleton {
	private signedInAs: string | null = null;

	signIn(name: string): void {
		this.signedInAs = name;
	}

	get who(): string | null {
		return this.signedInAs;
	}
}
