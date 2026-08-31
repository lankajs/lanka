import { TLankaQueryParams } from "./TLankaQueryParams";

export type TLankaQueryBuilder = (params: Record<string, TLankaQueryParams>) => URLSearchParams;
