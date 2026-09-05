import { ILankaCookieOptions } from "../_interfaces/ILankaCookieOptions";
import { ILankaCookieSetOptions } from "../_interfaces/ILankaCookieSetOptions";
import { ILankaCookieDeleteOptions } from "../_interfaces/ILankaCookieDeleteOptions";
type TCookieChangeItem = { name: string; value: unknown };

/**
 * Cookies, whichever API this engine has.
 *
 * An ordinary class with an ordinary instance rather than a namespace of
 * statics: `lankaCookies` below is the one every caller wants, and a second one
 * becomes possible the day an application needs cookies under its own prefix.
 */
export class LankaCookies {
	private readonly isBrowser: boolean = typeof window !== "undefined";
	private readonly useCookieStore: boolean = this.isBrowser && "cookieStore" in window;

	public isEnabled(): boolean {
		if (!this.isBrowser) return false;
		try {
			return navigator.cookieEnabled;
		} catch {
			return false;
		}
	}

	public async set(
		name: string,
		value: string | object,
		options: ILankaCookieOptions = {},
	): Promise<void> {
		if (!this.isBrowser) return;
		const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);

		if (this.useCookieStore) {
			const opts: ILankaCookieSetOptions = {
				...options,
			};

			// `else if`, not a second `if`: a `Date` became a timestamp on the line
			// above, and the line below then read that timestamp as a number of DAYS
			// — an expiry some fifty million years out, which the store either
			// refused or clamped, and either way not the date the caller passed.
			if (opts.expires instanceof Date) opts.expires = opts.expires.getTime();
			else if (typeof opts.expires === "number") {
				opts.expires = Date.now() + opts.expires * 864e5;
			}

			await window.cookieStore.set({
				name,
				value: stringValue,
				...opts,
				expires: opts.expires ?? undefined,
				domain: opts.domain ?? undefined,
				path: opts.path ?? undefined,
				sameSite: opts.sameSite ?? undefined,
				partitioned: opts.partitioned ?? undefined,
			});
		} else {
			let str = `${encodeURIComponent(name)}=${encodeURIComponent(stringValue)}`;
			if (options.expires) {
				const date =
					options.expires instanceof Date
						? options.expires
						: new Date(Date.now() + options.expires * 864e5);
				str += `; expires=${date.toUTCString()}`;
			}
			if (options.path) str += `; path=${options.path}`;
			if (options.domain) str += `; domain=${options.domain}`;
			if (options.secure) str += "; secure";
			if (options.sameSite) str += `; samesite=${options.sameSite}`;
			if (options.partitioned) str += "; partitioned";

			document.cookie = str;
		}
	}

	public async get<T = string>(name: string): Promise<T | null> {
		if (!this.isBrowser) return null;
		let value: string | null = null;

		if (this.useCookieStore) {
			const c = await window.cookieStore.get(name);
			value = c?.value ?? null;
		} else {
			const cookies = this.parseCookieString(document.cookie);
			value = cookies[name] || null;
		}
		return value ? this.tryParse<T>(value) : null;
	}

	public async getAll<T = unknown>(): Promise<Record<string, T>> {
		if (!this.isBrowser) return {};
		let cookies: CookieListItem[] = [];

		if (this.useCookieStore) {
			cookies = await window.cookieStore.getAll();
		} else {
			const docCookies = this.parseCookieString(document.cookie);
			cookies = Object.entries(docCookies).map(([n, v]) => ({
				name: n,
				value: v,
				domain: null,
				expires: null,
				path: "/",
				sameSite: "lax",
				secure: false,
				partitioned: false,
			}));
		}

		return cookies.reduce(
			(acc, c: CookieListItem) => {
				if (c.name && c.value) acc[c.name] = this.tryParse<T>(c.value);
				return acc;
			},
			{} as Record<string, T>,
		);
	}

	public async has(name: string): Promise<boolean> {
		return (await this.get(name)) !== null;
	}

	public async remove(name: string, options?: ILankaCookieDeleteOptions): Promise<void> {
		if (!this.isBrowser) return;

		if (this.useCookieStore) {
			await window.cookieStore.delete({
				name,
				...options,
				path: options?.path ?? undefined,
				domain: options?.domain ?? undefined,
				partitioned: options?.partitioned ?? undefined,
			});
		} else {
			const fallbackOptions: ILankaCookieOptions = {
				path: options?.path ?? undefined,
				domain: options?.domain ?? undefined,
				partitioned: options?.partitioned ?? undefined,
				expires: new Date(0),
			};

			await this.set(name, "", fallbackOptions);
		}
	}

	public async clear(): Promise<void> {
		const keys = await this.keys();
		await Promise.all(keys.map((k) => this.remove(k)));
	}

	public async keys(): Promise<string[]> {
		return Object.keys(await this.getAll());
	}

	public watch(
		cb: (e: { changed: TCookieChangeItem[]; deleted: TCookieChangeItem[] }) => void,
		interval = 500,
	): () => void {
		if (!this.isBrowser) return () => {};

		if (this.useCookieStore) {
			const fn = (e: CookieChangeEvent) =>
				cb({
					changed: e.changed.map((c) => ({
						name: c.name ?? "",
						value: this.tryParse(c.value ?? null),
					})),
					deleted: e.deleted.map((c) => ({
						name: c.name ?? "",
						value: this.tryParse(c.value ?? null),
					})),
				});
			window.cookieStore.addEventListener("change", fn);
			return () => window.cookieStore.removeEventListener("change", fn);
		} else {
			let prev = document.cookie;
			const id = setInterval(() => {
				const curr = document.cookie;
				if (curr !== prev) {
					const oldC = this.parseCookieString(prev);
					const newC = this.parseCookieString(curr);

					const changed: TCookieChangeItem[] = [];
					const deleted: TCookieChangeItem[] = [];

					for (const n in newC) {
						if (oldC[n] !== newC[n]) {
							changed.push({
								name: n,
								value: this.tryParse(newC[n]),
							});
						}
					}
					for (const n in oldC) {
						if (!(n in newC)) {
							deleted.push({
								name: n,
								value: this.tryParse(oldC[n]),
							});
						}
					}

					if (changed.length || deleted.length) cb({ changed, deleted });
					prev = curr;
				}
			}, interval);
			return () => clearInterval(id);
		}
	}

	/**
	 * The value as `set` was given it: an object comes back an object, a string
	 * comes back a string.
	 *
	 * ## Why not simply `JSON.parse` and fall back
	 *
	 * That is what this did, and it read a type into a value nobody wrote one
	 * into. `set` takes `string | object` and writes JSON for the object and the
	 * string itself for the string — so a cookie holding `"1234567890123456789"`
	 * is a STRING, and parsing it answered a number with its last digits rounded
	 * away. `"true"` came back a boolean. Worst of the three, `"null"` came back
	 * as `null`, which `get` uses for "no such cookie" and `has` reads as absent.
	 *
	 * A leading `{` or `[` is the whole test, because those are the only shapes
	 * `set` ever writes as JSON. Everything else is handed back untouched, which
	 * is what `get<T = string>` promised all along.
	 */
	private tryParse<T>(val: string | null): T {
		if (!val) return null as unknown as T;
		if (!val.startsWith("{") && !val.startsWith("[")) return val as unknown as T;

		try {
			return JSON.parse(val) as T;
		} catch {
			return val as unknown as T;
		}
	}

	private parseCookieString(str: string): Record<string, string> {
		if (!str) return {};
		return str.split(";").reduce(
			(acc, v) => {
				const [k, ...rest] = v.split("=");
				if (!k.trim()) return acc;
				acc[decodeSafely(k.trim())] = decodeSafely(rest.join("=").trim());
				return acc;
			},
			{} as Record<string, string>,
		);
	}
}

/**
 * Percent-decodes what can be decoded, and hands back the rest as it was.
 *
 * `document.cookie` holds every cookie on the origin, including ones this code
 * never wrote: a server's, a sibling subdomain's, a third-party script's. One of
 * them carrying a stray `%` — `%E0%A4%A`, a value nobody encoded — made
 * `decodeURIComponent` throw, and every `get`, `getAll` and `watch` on the page
 * threw with it, over a cookie the application had no interest in.
 */
const decodeSafely = (encoded: string): string => {
	try {
		return decodeURIComponent(encoded);
	} catch {
		return encoded;
	}
};

/** The one every caller wants. */
export const lankaCookies = new LankaCookies();
