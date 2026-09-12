/**
 * A failure with an ADDRESS: which input it belongs to, and what to say there.
 *
 * `issues` on `LankaError` flattens the address into the text — `items.1.qty:
 * only 2 left` — which is right for a banner and useless for a form, which has
 * a place per input and must find it. The path here stays in segments because
 * the two form libraries this was designed against spell the same address
 * differently (`items.1.qty` and `items[1].qty`) and neither can be parsed back
 * out of a string safely: a message may contain a colon, a key may contain a
 * dot.
 *
 * Produced by the validation port from a schema's issues, and by an
 * application's request policy from a server body. Consumed by a ViewModel,
 * which hands it to whatever holds the fields — its own state, or a form.
 */
export interface ILankaFieldError {
	/**
	 * Segments, never a joined string: `["items", 1, "qty"]`.
	 *
	 * A segment is a name or an index and nothing else — a producer holding a
	 * symbol stringifies it, because no form can address one. EMPTY means the
	 * value as a whole: a cross-field refusal ("the dates are in the wrong
	 * order"), or a body that was not the expected shape at all. That is the
	 * form's ROOT, and an adapter routes it there rather than to an input named
	 * `""`.
	 */
	readonly path: readonly (string | number)[];
	/** What to show at that address when the application does not translate. */
	readonly message: string;
	/** The machine-readable reason, when the producer had one — what i18n keys on. */
	readonly code?: string;
}
