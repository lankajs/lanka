/** Which wire came back, since an application may hold more than one. */
export interface TAtlasStreamReconnectedEventData {
	wire: "events" | "board";
}
