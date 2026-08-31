import type { IPlaygroundEmployee } from "../_interfaces/IPlaygroundEmployee";

/**
 * The rows, built fresh on every call.
 *
 * Fresh on purpose: a refetch hands back objects parsed out of new JSON, and a
 * fixture shared by reference would make stabilisation look like it works when
 * nothing was stabilised.
 */
export const createPlaygroundEmployees = (): IPlaygroundEmployee[] => [
	{ id: 1, name: "Ada", role: { name: "admin" }, hiredAt: new Date("2019-03-01") },
	{ id: 2, name: "Grace", role: { name: "viewer" }, hiredAt: new Date("2021-11-20") },
	{ id: 3, name: "Alan", role: { name: "admin" }, hiredAt: new Date("2020-07-15") },
];
