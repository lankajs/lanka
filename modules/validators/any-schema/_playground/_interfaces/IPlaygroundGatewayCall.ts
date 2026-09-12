/** One call a gateway makes: which endpoint, and what shape the answer must be. */
export interface IPlaygroundGatewayCall {
	/** The label that appears in the error and the log when the body is wrong. */
	readonly context: string;
	/** The schema, in whichever library the feature that owns it was written in. */
	readonly schema: unknown;
}
