import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { createApp, defineComponent, h } from "vue";
import { hydrateLankaVM } from "@lankajs/host";
import { useLankaVM } from "@lankajs/vue";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/** This module's own ViewModel — the same reasoning as the React module's. */
const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

/**
 * A render function rather than a single-file component.
 *
 * Deliberate: this package is typechecked by plain `tsc` because it holds React
 * and Vue at once, and a `.vue` file would need a shim that types every
 * component as taking anything.
 */
const MissionsVue = defineComponent({
	setup() {
		const missions = useLankaVM(missionsVM);

		return () =>
			h(
				"ul",
				{ "aria-label": "Missions in Vue" },
				missions.value
					.rows()
					.items.map((mission) =>
						h("li", { key: mission.id }, `${mission.code} ${mission.title}`),
					),
			);
	},
});

/** What the shell calls — the same contract as `mountMissionsReact`. */
export const mountMissionsVue = (
	element: Element,
	missions: readonly IAtlasMission[],
): (() => void) => {
	hydrateLankaVM(missionsVM, { missions });

	const app = createApp(MissionsVue);
	app.mount(element);

	return () => app.unmount();
};
