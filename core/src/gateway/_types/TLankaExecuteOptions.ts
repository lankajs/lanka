/**
 * Transport options plus what core controls.
 *
 * `signal` and `timeoutMs` are taken out and never reach the transport as given:
 * core combines them into one signal and passes that.
 */
export type TLankaExecuteOptions<TOptions> = TOptions & {
	signal?: AbortSignal;
	/** The attempt's deadline. It stops while the page is seen hidden, and resumes when it shows. */
	timeoutMs?: number;
};
