import { createFakeInitHost } from "../../src/_testing/createFakeInitHost";
import { playgroundRoot } from "../playground-root/playgroundRoot";
import type { IFakeInitHost } from "../../src/_testing/createFakeInitHost";

/**
 * A project as one actually arrives: made by somebody else's scaffolder.
 *
 * This is the shape the command is for. `npm create vite` has already run, so
 * there is a manifest naming React, a `vite.config.ts` with React's plugin in
 * it, a `tsconfig.json` that knows nothing about `@lanka_di`, and a pnpm
 * lockfile. Every interesting thing this command does is a consequence of one of
 * those four already existing.
 *
 * An empty directory is the other case and it is the EASY one — nothing to keep,
 * nothing to advise about — which is why the default here is the hard one.
 */
export const createPlaygroundProject = (answers: Record<string, string> = {}): IFakeInitHost =>
	createFakeInitHost({
		answers,
		files: {
			[`${playgroundRoot}/package.json`]: JSON.stringify(
				{
					name: "orders",
					private: true,
					type: "module",
					dependencies: { react: "^19.2.0", "react-dom": "^19.2.0" },
					devDependencies: { vite: "^7.3.1", "@vitejs/plugin-react": "^5.1.2" },
				},
				null,
				"\t",
			),
			[`${playgroundRoot}/pnpm-lock.yaml`]: "lockfileVersion: '9.0'\n",
			[`${playgroundRoot}/vite.config.ts`]:
				'import react from "@vitejs/plugin-react";\n' +
				'import { defineConfig } from "vite";\n\n' +
				"export default defineConfig({ plugins: [react()] });\n",
			[`${playgroundRoot}/tsconfig.json`]: JSON.stringify(
				{ compilerOptions: { strict: true }, include: ["src"] },
				null,
				"\t",
			),
		},
	});
