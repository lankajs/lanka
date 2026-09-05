import type { ILankaInstance } from "lanka";
import type { ILankaFakeTransport } from "@lankajs/tool-testing";
import type { ILankaDevtoolsPlugin, ILankaDevtoolsPanelOptions } from "../../src/index";
import type { PlaygroundCartGateway } from "../playground-cart-gateway/PlaygroundCartGateway";

/** An application being watched, and the one button that makes it busy. */
export interface IPlaygroundInspected {
	lanka: ILankaInstance;
	devtools: ILankaDevtoolsPlugin;
	cartGateway: PlaygroundCartGateway;
	/** The one seam the outside world is stubbed at. */
	transport: ILankaFakeTransport;
	/** Does what an application does: fires events, logs, and calls the wire. */
	useTheApp: () => Promise<void>;
	/** Opens the panel, or answers nothing where a panel cannot exist. */
	showPanel: (options?: ILankaDevtoolsPanelOptions) => (() => void) | undefined;
}
