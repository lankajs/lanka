import { lankaCookies } from "../../src/index";
import { isConsent } from "../_guards/isConsent";
import type { IPlaygroundConsent } from "../_interfaces/IPlaygroundConsent";

const CONSENT_KEY = "playground-consent";
const A_YEAR_MS = 31_536_000_000;

/**
 * A consent banner, which is what cookies are usually reached for.
 *
 * The package exists because browsers disagree: the Cookie Store API is
 * asynchronous and not everywhere, `document.cookie` is synchronous and always.
 * A consumer should not have to know which one answered — which is why every
 * method here is awaited and none of them asks.
 */
export const createPlaygroundConsent = () => ({
	/** Whether cookies can be used at all — a server render has no document. */
	isAvailable: (): boolean => lankaCookies.isEnabled(),

	/** What the visitor chose, or nothing if they have not. */
	async read(): Promise<IPlaygroundConsent | null> {
		const stored = await lankaCookies.get<unknown>(CONSENT_KEY);
		return isConsent(stored) ? stored : null;
	},

	async accept(choice: IPlaygroundConsent): Promise<void> {
		await lankaCookies.set(CONSENT_KEY, choice, {
			path: "/",
			expires: Date.now() + A_YEAR_MS,
		});
	},

	async withdraw(): Promise<void> {
		await lankaCookies.remove(CONSENT_KEY, { name: CONSENT_KEY, path: "/" });
	},

	/** Whether a cookie exists at all, whatever it holds. */
	hasChoice: (): Promise<boolean> => lankaCookies.has(CONSENT_KEY),
});
