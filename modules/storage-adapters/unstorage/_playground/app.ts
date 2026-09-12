/**
 * Work on a server that has to outlive the request that started it.
 *
 * There is no fixture engine here, and that is the point: unstorage runs in
 * node, so the scenes drive the real library over its memory driver. What a
 * double would have proved about the mapping, the library proves about the
 * mapping AND about the shape this package believes the library has.
 */
export { createPlaygroundServerSession } from "./create-playground-server-session/createPlaygroundServerSession";
