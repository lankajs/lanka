import { createLankaVM } from "lanka/viewmodel";
import { PlaygroundProfileGateway } from "../playground-profile-gateway/PlaygroundProfileGateway";
import type { ILankaFakeTransport } from "../../src/index";
import type { IPlaygroundProfileState } from "../_interfaces/IPlaygroundProfileState";

/** The ViewModel a consumer would be testing, with its one failure path. */
export const createPlaygroundProfileVM = (transport: ILankaFakeTransport) => {
	const profileGateway = new PlaygroundProfileGateway(transport);

	return createLankaVM<
		IPlaygroundProfileState,
		{ load: () => Promise<void> },
		{ profileGateway: PlaygroundProfileGateway }
	>({
		name: "PlaygroundProfileVM",
		gateways: () => ({ profileGateway }),
		states: { profile: null, error: null },
		createActions: ({ set, gateways }) => ({
			async load() {
				try {
					set({ profile: await gateways.profileGateway.load(), error: null });
				} catch (error) {
					set({ error: error instanceof Error ? error.message : "unknown" });
				}
			},
		}),
	});
};
