import type { ILankaSkillHost } from "../_interfaces/ILankaSkillHost";
import type { ILankaSkillSource } from "../_interfaces/ILankaSkillSource";

export interface IFindLankaSkillSourcesOptions {
	/** The consumer's project root — the folder holding their `package.json`. */
	root: string;
	host: ILankaSkillHost;
}

/** Where a package's shipped skills live inside its tarball. */
const SKILLS_DIRNAME = "skills";

const isLankaPackage = (name: string): boolean => name === "lanka" || name.startsWith("@lankajs/");

/**
 * Every dependency name a consumer declared, whichever field it sits in.
 *
 * All four fields, because a framework package can honestly appear in any of
 * them: a plugin is often a dependency, the test kit a devDependency, and core a
 * peer in a library built on top of lanka.
 */
const declaredDependencies = (manifest: unknown): string[] => {
	if (typeof manifest !== "object" || manifest === null) return [];

	const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
	const names = new Set<string>();

	for (const field of fields) {
		const section = (manifest as Record<string, unknown>)[field];
		if (typeof section !== "object" || section === null) continue;
		for (const name of Object.keys(section)) names.add(name);
	}

	return [...names];
};

/** The installed version, or a placeholder — a missing version is not a reason to skip a skill. */
const installedVersion = (manifest: unknown): string => {
	if (typeof manifest !== "object" || manifest === null) return "unknown";
	const version = (manifest as { version?: unknown }).version;
	return typeof version === "string" ? version : "unknown";
};

/**
 * The skills of every lanka package installed in a project.
 *
 * Read from `node_modules` rather than from a list this tool keeps: a hard-coded
 * list is wrong the day a package is added, and wrong in the other direction for
 * a consumer who installed only three of them.
 */
export const findLankaSkillSources = (
	options: IFindLankaSkillSourcesOptions,
): ILankaSkillSource[] => {
	const { root, host } = options;
	const manifest = host.readJsonFile(`${root}/package.json`);

	const sources: ILankaSkillSource[] = [];

	for (const packageName of declaredDependencies(manifest).filter(isLankaPackage).sort()) {
		const installed = host.resolvePackageDir(packageName, root);
		if (installed === null) continue;

		const skillsDir = `${installed}/${SKILLS_DIRNAME}`;
		if (!host.exists(skillsDir)) continue;

		const version = installedVersion(host.readJsonFile(`${installed}/package.json`));

		for (const skill of host.listDirectories(skillsDir)) {
			sources.push({ packageName, version, skill, dir: `${skillsDir}/${skill}` });
		}
	}

	return sources;
};
