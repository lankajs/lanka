import type { ILankaFieldError } from "../../src/errors/index";

/**
 * The application's reading of ITS backend's 422 body:
 * `{ errors: { "items.1.qty": ["only 2 left"] } }`, or the same with
 * `{ message, code }` objects where the backend names its reasons.
 *
 * Written here, in the application, because which shape a backend sends is
 * policy: core carries the body without reading it, and `@lankajs/plugin-http`
 * is where an application that installs it configures a reader for this shape.
 * The playground writes the lines itself to show WHERE they go — once, in the
 * gateway — and what they produce: addresses in segments, an index a number,
 * a `code` when the server gave one, so a form places each message on its line
 * and an application that translates has a key to translate by.
 */
export const readPlaygroundFieldErrors = (body: unknown): ILankaFieldError[] => {
	if (typeof body !== "object" || body === null) return [];

	const errors = (body as { errors?: unknown }).errors;
	if (typeof errors !== "object" || errors === null) return [];

	return Object.entries(errors as Record<string, unknown>).flatMap(([address, messages]) => {
		const path = address
			.split(".")
			.map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
		const list = Array.isArray(messages) ? messages : [messages];

		return list.flatMap((entry): ILankaFieldError[] => {
			if (typeof entry === "string") return [{ path, message: entry }];
			if (typeof entry === "object" && entry !== null && "message" in entry) {
				const named = entry as { message: unknown; code?: unknown };
				return [
					{
						path,
						message: String(named.message),
						...(typeof named.code === "string" ? { code: named.code } : {}),
					},
				];
			}
			return [];
		});
	});
};
