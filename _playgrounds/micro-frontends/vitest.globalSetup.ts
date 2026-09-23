import { MICRO_FRONTEND_PIPELINES } from "./src/Core/Build/microFrontendPipelines";
import { buildMicroFrontend } from "./src/Core/Build/buildMicroFrontend";

/**
 * Every team's pipeline, run once before the suites, in the main process.
 *
 * Here rather than in a `build:app` step: the suites are what `pnpm check`
 * runs, and a bundle nobody rebuilt would test yesterday's source. What is
 * built, and why that matrix, is in `microFrontendPipelines.ts`.
 */
export default async function buildThePipelines(): Promise<void> {
	for (const pipeline of MICRO_FRONTEND_PIPELINES) await buildMicroFrontend(pipeline);
}
