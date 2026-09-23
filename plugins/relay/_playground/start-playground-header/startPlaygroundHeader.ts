import { createLanka } from "lanka/bootstrap";
import { resolveLankaVM } from "lanka/extend";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaRelay } from "../../src/index";
import { playgroundBadge } from "../playground-badge/playgroundBadge";
import { playgroundCartChanged } from "../playground-cart-changed/playgroundCartChanged";
import type { IPlaygroundApplication } from "../_interfaces/IPlaygroundApplication";
import type { TPlaygroundBadgeVM } from "../playground-badge/playgroundBadge";
import type { ILankaRelayTransport } from "../../src/index";

/**
 * The header: another application, which only RECEIVES the cart's changes.
 *
 * It knows the shop by one string — the channel — and by the event type it
 * accepts. Nothing of the shop is imported, which is the arrangement a relay is
 * for: two applications nobody built together.
 */
export const startPlaygroundHeader = async (
	channel: string,
	transport?: ILankaRelayTransport,
): Promise<IPlaygroundApplication<TPlaygroundBadgeVM>> => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.use(lankaRelay({ channel, receive: [playgroundCartChanged.eventType], transport }));
	await lanka.bootstrap();

	const scope = lanka.createScope();

	return { lanka, scope, viewModel: resolveLankaVM(playgroundBadge, { scope }) };
};
