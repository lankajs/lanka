export interface ILankaCookieOptions {
	expires?: number | Date;
	path?: string;
	domain?: string;
	secure?: boolean;
	sameSite?: "strict" | "lax" | "none";
	partitioned?: boolean;
}
