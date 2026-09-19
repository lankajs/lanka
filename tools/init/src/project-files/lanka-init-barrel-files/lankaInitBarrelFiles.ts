import { lankaDiContract } from "@lankajs/tool-di";
import type { ILankaInitFile } from "../../_interfaces/ILankaInitFile";

/**
 * The barrels an application publishes to the framework.
 *
 * The file NAMES, the export the framework reads by name and the version the
 * barrels are written for all come from `lankaDiContract` — the package that
 * owns them — rather than from a list here. A second list would be a second
 * answer to "what is a barrel", and the two would part company on the day a
 * seventh barrel arrives.
 *
 * What this file adds is the BODIES, because the contract's own stubs are empty
 * by design — a project scaffolded by a build has nothing to export yet — and
 * this command has just written a gateway, a scenario and a host for them to
 * name. A barrel the contract grows that this file has no body for still gets
 * written: the stub the contract carries is the fallback, so a seventh barrel
 * needs no edit here to be correct.
 */

const HEADER = `/**
 * Read by the framework, never by this application.
 *
 * \`@lanka_di/*\` resolves here, and \`@lankajs/tool-eslint\` refuses an import of
 * it from your own code: a second route to a gateway is invisible to the
 * framework, cannot be substituted in a test and cannot be disposed with the
 * instance. Your own code imports the class directly, or asks the locator.
 */
`;

const BODIES: Readonly<Record<string, string>> = {
	"Contract.ts": `/**
 * The lanka contract version these barrels are written for.
 *
 * Updated when the framework is updated, not by hand: the number tells it the
 * barrels beside it are shaped as it expects. Out of step, they give the most
 * expensive failure — file present, export present, different semantics.
 */
export const lankaDiContractVersion = ${String(lankaDiContract.version)};
`,

	"Host.ts": `${HEADER}export { appHost as lankaHost } from "../src/Core/Configs/appHost";
`,

	"Gateways.ts": `${HEADER}export { TodoGateway } from "../src/Gateways/TodoGateway/TodoGateway";
`,

	"Scenarios.ts": `${HEADER}export { TodoCompleted } from "../src/Scenarios/TodoCompleted/TodoCompleted";
`,
};

/** What each barrel is for, said where the plan lists it. */
const GISTS: Readonly<Record<string, string>> = {
	"Contract.ts": "which contract these barrels are written for",
	"Host.ts": "the base URL and the three sentences a failure is shown as",
	"Gateways.ts": "one export line per gateway; the locator is derived from them",
	"Scenarios.ts": "one export line per scenario",
	"SharedStores.ts": "one export line per shared store",
	"Singletons.ts": "one export line per singleton",
};

/**
 * Every barrel, in the directory this project uses.
 *
 * `.lanka` is what a new project gets and `.lanka_di` is what the first
 * consumers got; both are read, and neither is deprecated. This writes the
 * default, because a project with no barrels at all is the one case the default
 * decides — and `lanka-di where` is what answers the question afterwards.
 */
export const lankaInitBarrelFiles = (): readonly ILankaInitFile[] =>
	lankaDiContract.barrels.map((barrel) => ({
		path: `${lankaDiContract.dirname}/${barrel.file}`,
		text: BODIES[barrel.file] ?? barrel.stub,
		gist: GISTS[barrel.file] ?? "a barrel the framework reads",
	}));
