export interface ILankaCookieSetOptions {
	domain?: string | null;
	expires?: number | Date | null;
	path?: string | null;
	name?: string;
	sameSite?: "strict" | "lax" | "none";
	secure?: boolean;
	partitioned?: boolean;
	value?: string;
}
