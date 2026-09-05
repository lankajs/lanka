import { createLankaVM } from "lanka/viewmodel";
import { lankaLogger } from "lanka/logger";
import { PlaygroundProfileGateway } from "../playground-profile-gateway/PlaygroundProfileGateway";
import { playgroundProfileLoaded } from "../playground-profile-loaded/PlaygroundProfileLoaded";
import type { ILankaInstance } from "lanka/bootstrap";
import type { ILankaTransport } from "lanka/gateway";
import type { IPlaygroundProfileAudit } from "../_interfaces/IPlaygroundProfileAudit";
import type { IPlaygroundProfileState } from "../_interfaces/IPlaygroundProfileState";

export interface IPlaygroundProfileVMConfig {
	transport: ILankaTransport<RequestInit>;
	/** The instance the singleton is resolved from. */
	lanka: ILankaInstance;
}

/**
 * The ViewModel a consumer would be testing.
 *
 * It does the four things an ordinary one does and each is something a test
 * needs to see: it calls a gateway, it resolves a singleton by name, it writes
 * to the log, and it announces a fact on the bus. None of them is arranged for
 * the kit's convenience — that is the point of the fixture.
 */
export const createPlaygroundProfileVM = (config: IPlaygroundProfileVMConfig) => {
	const profileGateway = new PlaygroundProfileGateway(config.transport);

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
					const profile = await gateways.profileGateway.load();
					set({ profile, error: null });

					config.lanka
						.resolve<IPlaygroundProfileAudit>("playgroundProfileAudit")
						.record(profile.name);
					lankaLogger.printViewModelLog(`profile loaded: ${profile.name}`);
					playgroundProfileLoaded.trigger(profile);
				} catch (error) {
					set({ error: error instanceof Error ? error.message : "unknown" });
				}
			},
		}),
	});
};
