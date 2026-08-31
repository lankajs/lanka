import type { ILankaFlags } from "../../config/_interfaces/ILankaFlags";
import type { ILankaHost } from "../../config/_interfaces/ILankaHost";
import type { ILankaPlugin } from "../ILankaPlugin";
import type {
	ILankaBootstrapConfig,
	ILankaServiceConfig,
} from "../_factories/create-lanka/createLanka";

/** What `startLanka` takes beyond the host, all of it optional. */
export interface ILankaStartOptions {
	flags?: ILankaFlags;
	/** Installed before bootstrap, in the order given. */
	plugins?: readonly ILankaPlugin[];
	services?: ILankaServiceConfig[];
	scenarios?: ILankaBootstrapConfig["scenarios"];
}

/**
 * A whole host, or the pieces of one — but not both.
 *
 * A union rather than three optional fields, so passing `host` AND `apiBaseUrl`
 * is a compile error rather than a silent precedence rule somebody has to look
 * up. Passing neither is fine: an application served from its API's origin, or
 * one whose gateways write whole URLs, has nothing to say here.
 */
export type TLankaStartConfig = ILankaStartOptions &
	(
		| { host: ILankaHost; apiBaseUrl?: never; messages?: never }
		| {
				host?: never;
				/** A prefix for every path a gateway builds. Empty by default. */
				apiBaseUrl?: string;
				/** Anything but the base URL, when English is not good enough. */
				messages?: Partial<Omit<ILankaHost, "apiBaseUrl">>;
		  }
	);
