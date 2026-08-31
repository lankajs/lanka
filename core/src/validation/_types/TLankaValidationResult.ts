export type TLankaValidationResult<T> =
	{ success: true; data: T } | { success: false; errors: string[] };
