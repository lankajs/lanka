export type TLankaQueryParams =
	| string
	| number
	| boolean
	| null
	| undefined
	| TLankaQueryParams[]
	| { [key: string]: TLankaQueryParams };
