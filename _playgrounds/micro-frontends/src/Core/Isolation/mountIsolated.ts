import { lankaRelay } from "@lankajs/plugin-relay";
import { startLanka } from "lanka/bootstrap";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { ILankaRelayOptions } from "@lankajs/plugin-relay";
import type { TMissionsMount } from "../Mount/TMissionsMount";

/**
 * A module mounted with ITS OWN lanka, on purpose, joined to the page's channel.
 *
 * The arrangement for an application that cannot share the shell's copy —
 * another version of the framework, another team's pipeline, isolation by
 * decision — and still has to hear what happens on the page. The module itself
 * is the SAME entry a shared-lanka shell mounts: isolation is a decision about
 * where it runs, not a second way to write it. It owns the scope its screen
 * lives in, since a scope belongs to one copy and the shell's cannot be handed
 * across.
 *
 * ## It joins the channel LAST
 *
 * After its screen is mounted and listening, not in `startLanka`'s plugins. A
 * value the page retained is handed over the moment an application joins, so
 * joining last lands it on a subscriber directly — the alternative is a
 * handler that asks for `replay: "last"`, which the shared ViewModel this module
 * renders does not, and should not have to.
 *
 * What comes back takes the module off the page entirely: the screen, its
 * scope, and its place on the channel.
 */
export const mountIsolated = async (
	mount: TMissionsMount,
	element: Element,
	missions: readonly IAtlasMission[],
	relay: Omit<ILankaRelayOptions, "channel">,
): Promise<() => void> => {
	const lanka = await startLanka();
	const scope = lanka.createScope();
	const unmount = await mount(element, { missions, scope });

	// The page's one channel. The shell joins the same name; nothing else is shared.
	lanka.use(lankaRelay({ channel: "atlas", ...relay }));

	return () => {
		unmount();
		scope.dispose();
		lanka.dispose();
	};
};
