import { lankaDiContract } from "../../src/index";

/** Every barrel the contract requires, by name. */
export const requiredBarrels = (): string[] => lankaDiContract.barrels.map((barrel) => barrel.file);
