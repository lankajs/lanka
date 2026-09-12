import type { IPlaygroundOrderItem } from "./IPlaygroundOrder";

/**
 * What a person edits: the order without what only the server assigns.
 *
 * The INPUT shape is the third schema role beside the wire and the domain. A
 * form given the domain schema would demand an `id` and an `updatedAt` the user
 * does not have; a form given this one asks for exactly what it shows.
 */
export interface IPlaygroundOrderInput {
	customer: string;
	items: IPlaygroundOrderItem[];
}
