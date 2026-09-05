/**
 * `RequestInit`, with the body a JSON API actually sends.
 *
 * `RequestInit["body"]` is `BodyInit | null` — a string, a `FormData`, a blob,
 * bytes. It is what `fetch` accepts and it is NOT what a gateway method writes:
 * every one of them writes `body: { name, email }`, an object, and lets the
 * transport encode it.
 *
 * The framework's transport has always encoded that object. The TYPE never
 * admitted it, and the cost was not a cast at the call site — it was a fork. A
 * consumer could not write `body: { … }` against `RequestInit`, so they declared
 * their own options type; declaring it made every shipped transport
 * unassignable, because those were fixed to `RequestInit`; so they wrote a
 * transport too, and with it a base URL, a CSRF header and an auth refresh the
 * framework already had. One wrong type produced a re-implementation of three
 * packages.
 *
 * `unknown` rather than a union of the encodable shapes: the transport decides
 * by INSPECTING the value, and a type listing what it accepts would have to be
 * kept in step with that inspection by hand. What is not a `BodyInit` is JSON —
 * that is the whole rule, and it needs no enumeration.
 */
export type TLankaRequestInit = Omit<RequestInit, "body"> & {
	/**
	 * Anything. A `BodyInit` travels as given; everything else is encoded as JSON.
	 */
	body?: unknown;
};
