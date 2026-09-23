import { expect } from "vitest";
import { atlasMissionAssigned } from "@lanka-playgrounds/_shared";
import { lankaRelay } from "@lankajs/plugin-relay";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { startLanka } from "lanka/bootstrap";
import { screen, waitFor, within } from "@testing-library/dom";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { ILankaInstance } from "lanka/bootstrap";
import type { TLankaSharing, TMicroFrontendBundler } from "../Core/Build/IMicroFrontendBuild";
import type { TMissionsMount } from "../Core/Mount/TMissionsMount";

/**
 * The shell's side of the page, shared by every suite here.
 *
 * The shell is the test: it starts lanka, reserves a region of the page per
 * module, hands a shared-lanka module a scope, and loads bundles the way a
 * shell loads remotes — whatever does that in production.
 */

/** Everything a bundle may export: one mount per framework, and the isolated entries. */
export interface IMissionsBundle {
	mountMissionsReact?: TMissionsMount;
	mountMissionsVue?: TMissionsMount;
	mountMissionsSvelte?: TMissionsMount;
	mountMissionsAngular?: TMissionsMount;
	mountReactIsolated?: (
		element: Element,
		missions: readonly IAtlasMission[],
	) => Promise<() => void>;
	mountVueIsolated?: (
		element: Element,
		missions: readonly IAtlasMission[],
	) => Promise<() => void>;
	mountAngularIsolated?: (
		element: Element,
		missions: readonly IAtlasMission[],
	) => Promise<() => void>;
}

/**
 * A bundle, loaded from where its pipeline put it.
 *
 * Relative to this file on purpose: `vitest.config.ts` says why a bundle must
 * be resolved from inside this application.
 */
export const loadBundle = async (
	bundler: TMicroFrontendBundler,
	sharing: TLankaSharing,
	name: string,
): Promise<IMissionsBundle> =>
	(await import(`../../dist/${bundler}/${sharing}/${name}.js`)) as IMissionsBundle;

export const mission = (
	id: string,
	title: string,
	over: Partial<IAtlasMission> = {},
): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-23T00:00:00.000Z",
	...over,
});

/** What every module is handed at mount: the rows the shell already has. */
export const FROM_THE_SHELL = [
	mission("m-1", "Survey the north ridge"),
	mission("m-2", "Restock the depot"),
];

export const SURVEY = "AT-101 Survey the north ridge";
export const CONVOY = "AT-101 Escort the relay convoy";

/** An element for one module, the way a shell reserves a region of its page. */
export const region = (): HTMLElement =>
	document.body.appendChild(document.createElement("section"));

/** The assignment, announced by the shell itself. */
export const assignConvoyFromTheShell = (): void => {
	atlasMissionAssigned.trigger({
		id: "m-1",
		crewId: "c-1",
		mission: mission("m-1", "Escort the relay convoy", { crewId: "c-1" }),
	});
};

/**
 * The shell's start-up, called inside each scene.
 *
 * The test kit's setup puts a fresh, unstarted instance in place before every
 * test, so a framework started once for the file would not be the active one
 * by the time a scene runs — and starting inside the scene is the order a page
 * has anyway: the shell starts, THEN the remotes arrive.
 *
 * It joins the page's channel as a full member for the one event the page
 * shares: it sends it, receives it, and retains it, so an application that
 * arrives late is handed the current value even after whoever announced it has
 * left.
 */
export const startShell = (): Promise<ILankaInstance> =>
	startLanka({
		host: lankaTestHost,
		flags: { isDevelopment: true },
		plugins: [
			lankaRelay({
				channel: "atlas",
				send: [atlasMissionAssigned.eventType],
				receive: [atlasMissionAssigned.eventType],
				retain: [atlasMissionAssigned.eventType],
			}),
		],
	});

/** A module's list, found by the label its framework gave it. */
export const listIn = async (label: string) => within(await screen.findByLabelText(label));

/** Waits until the list labelled `label` shows `text`. */
export const showsIn = async (label: string, text: string): Promise<void> => {
	const list = await listIn(label);
	await waitFor(() => expect(list.getByText(text)).toBeDefined());
};
