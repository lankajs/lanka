import { ALankaVM } from "lanka/viewmodel";
import { LankaPolling } from "@lankajs/async";
import { atlasBoardMessagePosted } from "../../Scenarios/Scenarios/AtlasBoardMessagePosted/atlasBoardMessagePosted";
import { readAtlasFailure } from "../../Core/Failures/readAtlasFailure";
import type {
	AtlasBoardGateway,
	IAtlasBoardSummary,
} from "../../Gateways/AtlasBoardGateway/AtlasBoardGateway";
import type { TAtlasBoardMessagePostedEventData } from "../../Scenarios/ScenarioTypes/TAtlasBoardMessagePostedEventData";

/** What the board screen holds. */
export interface IAtlasBoardState {
	summary: IAtlasBoardSummary | null;
	messages: readonly TAtlasBoardMessagePostedEventData[];
	error: string | null;
	/** Reasons the last summary was partial. A page that rendered, with a caveat. */
	partial: readonly string[];
}

/** What the board screen can do. */
export interface IAtlasBoardActions {
	fetchSummary: () => Promise<void>;
	applyMessage: (message: TAtlasBoardMessagePostedEventData) => void;
	startPolling: () => void;
	stopPolling: () => void;
}

/** What it reaches for. */
export interface IAtlasBoardGateways {
	boardGateway: AtlasBoardGateway;
}

/** How often to ask for what nobody pushes. */
const POLL_MS = 15_000;

/**
 * The board, written as a CLASS — the same role the missions screen writes by
 * calling.
 *
 * The protected surface is exactly the factory's context: `set`, `get`,
 * `gateways`, `services`, `trigger`. That is enforced rather than agreed, which
 * is what makes "both styles over one implementation" a test rather than a
 * claim.
 *
 * It also holds the third async primitive. Polling is for what nobody pushes:
 * the summary is computed upstream and no event announces it, so the screen asks
 * — and the instance is held by the screen and cleared on the way out, because a
 * subscription that outlives its screen is the leak this API is shaped to make
 * obvious.
 */
export class AtlasBoardVM extends ALankaVM<
	IAtlasBoardState,
	IAtlasBoardActions,
	IAtlasBoardGateways
> {
	protected readonly name = "AtlasBoardVM";

	private readonly gateway: AtlasBoardGateway;
	private readonly polling = new LankaPolling();
	private pollId: string | null = null;

	public constructor(gateway: AtlasBoardGateway) {
		super();
		this.gateway = gateway;
	}

	protected override states(): IAtlasBoardState {
		return { summary: null, messages: [], error: null, partial: [] };
	}

	protected override createGateways(): IAtlasBoardGateways {
		return { boardGateway: this.gateway };
	}

	protected override scenarioHandlers() {
		return [
			{
				scenario: atlasBoardMessagePosted,
				handler:
					() =>
					(data?: TAtlasBoardMessagePostedEventData): void => {
						if (!data) return;
						this.set({ messages: [...this.get().messages, data] });
					},
			},
		];
	}

	protected createActions(): IAtlasBoardActions {
		return {
			fetchSummary: async () => {
				try {
					this.set({ summary: await this.gateways.boardGateway.summary(), error: null });
				} catch (failure) {
					this.set({ error: readAtlasFailure(failure) });
				}
			},

			applyMessage: (message) => {
				this.set({ messages: [...this.get().messages, message] });
			},

			startPolling: () => {
				if (this.pollId !== null) return;
				// The first run is immediate: a board that waits fifteen seconds for
				// its first number is a board that looks broken on arrival.
				this.pollId = this.polling.subscribe(() => this.get().fetchSummary(), POLL_MS, 0);
			},

			stopPolling: () => {
				// `clearAll`, not `unsubscribe`: this instance belongs to this screen
				// and nothing else uses it, so leaving anything running is the leak.
				this.polling.clearAll();
				this.pollId = null;
			},
		};
	}
}
