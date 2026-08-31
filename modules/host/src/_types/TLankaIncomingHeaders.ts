/**
 * What a host framework hands over as the incoming request's headers.
 *
 * Two shapes because the hosts differ: Next's `headers()` and a loader's
 * `request.headers` are `Headers`-like and iterate through `forEach`; a test, a
 * queue worker or a custom server has a plain object.
 */
export type TLankaIncomingHeaders =
	| { forEach: (visit: (value: string, key: string) => void) => void }
	| Readonly<Record<string, string | undefined>>;
