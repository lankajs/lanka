import { createAtlasServer } from "./create-atlas-server/createAtlasServer";

/**
 * The executable entry: `pnpm --filter @lanka-playgrounds/_server start`.
 *
 * A file whose whole job is to read the environment and start listening, so
 * every other file in this package can be imported by a test without binding a
 * port. The port is fixed rather than chosen, because four applications name it
 * in four configuration files and a port that moved would be four edits.
 */
const DEFAULT_PORT = 4380;

const port = Number(process.env.ATLAS_PORT ?? DEFAULT_PORT);
const server = createAtlasServer();

const url = await server.listen(port);

console.log(`atlas api listening on ${url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		void server.close().then(() => process.exit(0));
	});
}
