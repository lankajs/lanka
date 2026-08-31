import { ILankaAsyncStorageAdapter } from "./ILankaAsyncStorageAdapter";
import { ILankaSyncStorageAdapter } from "./ILankaSyncStorageAdapter";

export interface ILankaStorageAdapter
	extends ILankaAsyncStorageAdapter, Partial<ILankaSyncStorageAdapter> {}
