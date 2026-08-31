/**
 * What the package needs from the HOSTING application and cannot know itself.
 *
 * A package cannot import its consumer, and should not: these are product
 * decisions belonging to whoever owns the screens and the session.
 *
 * The fields are REQUIRED, and that is the point. None has a sensible default —
 * a missing message factory would mean a wrong-language string in the interface,
 * a missing base URL an `undefined` inside a request path. So omitting one is a
 * TYPE ERROR in the app's own barrel rather than a surprise at runtime.
 */
export interface ILankaHost {
	/**
	 * What to show when a response carried a status but no message.
	 *
	 * ONE method rather than a map of seven: which statuses the app has copy for,
	 * and what it says for the rest, is the app's business. The package knows only
	 * that it has a number and needs a sentence.
	 */
	httpErrorMessage(status: number): string;
	/**
	 * API base URL — where the framework calls.
	 *
	 * In the contract because otherwise each consumer would know the URL and the
	 * framework would not, making `@lankajs/plugin-sse` impossible: it would
	 * have to know a specific application's build.
	 *
	 * Without a trailing slash — `ALankaGateway.endpoint()` normalises it.
	 */
	apiBaseUrl: string;
	/**
	 * What to say when the request never reached the server.
	 *
	 * `LankaError` separates `network` from `timeout` because the interface needs
	 * different things from them. How the app phrases each is not the framework's
	 * to guess.
	 */
	networkErrorMessage(): string;
	/** What to say when it arrived but no response came. */
	timeoutErrorMessage(): string;
}
