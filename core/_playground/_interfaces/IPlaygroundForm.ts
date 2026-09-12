/**
 * A form as a ViewModel sees it — which is to say, barely.
 *
 * This stands in for React Hook Form or TanStack Form in the scenes, and it is
 * as small as the seam between a ViewModel and a form actually is: the form
 * owns the values and the per-input errors; the ViewModel is handed values on
 * submit and answers with addressed failures. Nothing here reaches a gateway, a
 * scenario or the cache — a form that did would be a second ViewModel without a
 * name.
 *
 * The addresses are joined strings because that is what both libraries take;
 * the ViewModel hands over segments and the three-line adapter joins them the
 * way THIS library spells them.
 */
export interface IPlaygroundForm<TValues extends object> {
	readonly values: TValues;
	/** Per-input messages by joined address; `root` is the form-wide one. */
	readonly errors: ReadonlyMap<string, string>;
	readonly isDirty: boolean;
	setValues(partial: Partial<TValues>): void;
	setError(address: string, message: string): void;
	clearErrors(): void;
	/** Back to the given values — after a save, the saved ones. */
	reset(values?: TValues): void;
	/** Validates with the schema it was built with, then hands the values on. */
	handleSubmit(onValid: (values: TValues) => Promise<void>): Promise<void>;
	/** One input's asynchronous check: the answer is a message, or nothing. */
	validateField(
		address: string,
		check: (values: TValues) => Promise<string | null>,
	): Promise<void>;
}
