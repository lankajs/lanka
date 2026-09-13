import { ALankaSingleton } from "lanka/locator";
import { atlasSessionEnded } from "../../../Scenarios/Scenarios/AtlasSessionEnded/atlasSessionEnded";
import type { AtlasSessionGateway } from "../../../Gateways/AtlasSessionGateway/AtlasSessionGateway";
import type { IAtlasCredentials } from "../../Interfaces/IAtlasCredentials";

/**
 * Who is signed in, and the one place that knows how to stop being signed out.
 *
 * A singleton rather than a ViewModel: nothing renders it, and every layer needs
 * it — the request policy asks it to refresh, a screen asks it for a name, a
 * bootstrap step asks it to restore. A ViewModel is a screen's state; this is
 * the application's.
 *
 * It extends the marker, and that is not ceremony. Without it "a singleton"
 * means "any exported object", and a stray export in a barrel silently becomes
 * part of the public `lankaSingletons.*`.
 */
export class AtlasSession extends ALankaSingleton {
	private readonly gateway: AtlasSessionGateway;
	private session: IAtlasCredentials | null = null;
	/** How many refreshes have happened. A screen and a test both read it. */
	private renewals = 0;

	public constructor(gateway: AtlasSessionGateway) {
		super();
		this.gateway = gateway;
	}

	public current(): IAtlasCredentials | null {
		return this.session;
	}

	public renewalCount(): number {
		return this.renewals;
	}

	/** The value every unsafe request must carry. `null` while signed out. */
	public csrf(): string | null {
		return this.session?.csrf ?? null;
	}

	public token(): string | null {
		return this.session?.token ?? null;
	}

	public async signIn(name: string): Promise<IAtlasCredentials> {
		this.session = await this.gateway.open(name);

		return this.session;
	}

	/**
	 * Swaps a spent token for a fresh one, and says whether it worked.
	 *
	 * A BOOLEAN, because that is what the request policy's `refreshAuth` reads:
	 * `true` means "try the request again". Throwing here would make a refusal
	 * the caller has to catch in the middle of a retry ladder.
	 */
	public async renew(): Promise<boolean> {
		const refreshToken = this.session?.refreshToken;
		if (refreshToken === undefined) return false;

		try {
			this.session = await this.gateway.renew(refreshToken);
			this.renewals += 1;

			return true;
		} catch {
			// The session is gone for good. Announced rather than acted on: what it
			// MEANS differs per screen, and a service that navigated would be making
			// a decision that is not its to make.
			this.signOut("expired");

			return false;
		}
	}

	public signOut(reason: "signed-out" | "expired" = "signed-out"): void {
		this.session = null;
		atlasSessionEnded.trigger({ reason });
	}
}
