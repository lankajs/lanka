/** One row of the table this miniature application shows. */
export interface IPlaygroundEmployee {
	id: number;
	name: string;
	role: { name: string };
	hiredAt: Date;
}
