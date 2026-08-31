import type { ILankaInstance } from "lanka";
import type { ILankaDevtoolsPlugin } from "../../src/index";

/** An application being watched, and the one button that makes it busy. */
export interface IPlaygroundInspected {
	lanka: ILankaInstance;
	devtools: ILankaDevtoolsPlugin;
	/** Does what an application does: fires events, logs, and moves the wire. */
	useTheApp: () => void;
	/** Opens the panel, or answers nothing where a panel cannot exist. */
	showPanel: () => (() => void) | undefined;
}
