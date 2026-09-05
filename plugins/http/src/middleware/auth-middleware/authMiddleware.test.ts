import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { LankaFetchJsonRequest, type ILankaTransport } from "lanka/gateway";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaHttp } from "../../index";

/**
 * Auth refresh.
 *
 * The point is not "refresh" but "do not loop": in production an infinite loop
 * looks like a hung interface rather than an error, and is investigated far from
 * where it started.
 */

/** A transport that answers 401 a given number of times in a row. */
const unauthorizedTimes = (times: number) => {
	const calls: string[] = [];
	const transport: ILankaTransport<RequestInit> = {
		request: (endpoint: string) => {
			calls.push(endpoint);
			if (calls.length <= times) {
				return Promise.resolve(
					new Response(JSON.stringify({ errorCode: "UNAUTHORIZED" }), {
						status: 401,
						headers: { "content-type": "application/json" },
					}),
				);
			}
			return Promise.resolve(
				new Response(JSON.stringify({ ok: true }), {
					headers: { "content-type": "application/json" },
				}),
			);
		},
	};
	return { transport, calls };
};

const send = (transport: ILankaTransport<RequestInit>, endpoint = "/api/things") =>
	new LankaFetchJsonRequest({ transport }).execute(endpoint);

describe("@lankajs/plugin-http — auth refresh", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("on a 401 it refreshes once and retries the original request", async () => {
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		const { transport, calls } = unauthorizedTimes(1);
		lanka.use(lankaHttp({ auth: { refreshAuth } }));

		await expect(send(transport)).resolves.toEqual({ ok: true });
		expect(refreshAuth).toHaveBeenCalledTimes(1);
		expect(calls).toEqual(["/api/things", "/api/things"]);
	});

	it("a second 401 AFTER a refresh does not trigger another refresh", async () => {
		// Otherwise a loop: refreshed, 401 again, refreshed again. A second 401
		// after a successful refresh means the refresh DOES NOT WORK, and there is
		// no point continuing.
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		const { transport, calls } = unauthorizedTimes(99);
		lanka.use(lankaHttp({ auth: { refreshAuth } }));

		await expect(send(transport)).rejects.toMatchObject({ status: 401 });
		expect(refreshAuth).toHaveBeenCalledTimes(1);
		expect(calls).toHaveLength(2);
	});

	it("concurrent requests refresh ONCE for all of them", async () => {
		// A screen opens with five concurrent requests and all five get a 401. Five
		// refreshes would be five token rotations, four of which invalidate each
		// other.
		let resolveRefresh!: (value: boolean) => void;
		const refreshAuth = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolveRefresh = resolve;
				}),
		);
		// The first three calls fail; the retries after the refresh succeed.
		const { transport } = unauthorizedTimes(3);
		lanka.use(lankaHttp({ auth: { refreshAuth } }));

		const pending = [send(transport), send(transport), send(transport)];
		// Wait until all three hit the 401 and ask for a refresh: without this the
		// assertion would only prove the second and third had not got there yet.
		for (let tick = 0; tick < 50 && refreshAuth.mock.calls.length === 0; tick += 1) {
			await Promise.resolve();
		}
		resolveRefresh(true);
		await Promise.all(pending);

		expect(refreshAuth).toHaveBeenCalledTimes(1);
	});

	it("a failed refresh signs the user out and returns the original failure", async () => {
		const onRefreshFailed = vi.fn();
		const { transport, calls } = unauthorizedTimes(99);
		lanka.use(
			lankaHttp({ auth: { refreshAuth: () => Promise.resolve(false), onRefreshFailed } }),
		);

		await expect(send(transport)).rejects.toMatchObject({ status: 401 });
		expect(onRefreshFailed).toHaveBeenCalledTimes(1);
		// No retry: there was nothing to refresh with.
		expect(calls).toHaveLength(1);
	});

	it("a throwing refresh counts as failed instead of breaking the request", async () => {
		// An exception inside the refresh would replace the server's failure with
		// the refresh mechanism's failure, and the real cause would vanish.
		const onRefreshFailed = vi.fn();
		const { transport } = unauthorizedTimes(99);
		lanka.use(
			lankaHttp({
				auth: {
					refreshAuth: () => Promise.reject(new Error("network unavailable")),
					onRefreshFailed,
				},
			}),
		);

		await expect(send(transport)).rejects.toMatchObject({ status: 401 });
		expect(onRefreshFailed).toHaveBeenCalledTimes(1);
	});

	it("does not refresh at all on the sign-in and refresh paths", async () => {
		// A 401 on the refresh route itself means there is nothing to refresh with.
		// Refreshing in order to refresh is a loop over nothing.
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		const { transport } = unauthorizedTimes(99);
		lanka.use(
			lankaHttp({
				auth: { refreshAuth, shouldSkip: (endpoint) => endpoint.includes("/auth/") },
			}),
		);

		await expect(send(transport, "/api/auth/refreshAuth")).rejects.toMatchObject({
			status: 401,
		});
		expect(refreshAuth).not.toHaveBeenCalled();
	});

	it("other failures are left alone", async () => {
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		const transport: ILankaTransport<RequestInit> = {
			request: () => Promise.resolve(new Response(JSON.stringify({}), { status: 500 })),
		};
		lanka.use(lankaHttp({ auth: { refreshAuth } }));

		await expect(send(transport)).rejects.toMatchObject({ status: 500 });
		expect(refreshAuth).not.toHaveBeenCalled();
	});

	it("a FAILED refresh signs the user out ONCE for a burst, not once per waiting request", async () => {
		// The refresh is shared, so it runs once — and until this test the sign-out
		// did not follow it: every waiting request awaited the same promise and then
		// called  for itself. Three concurrent 401s produced three.
		//
		// It survived because both tests above send ONE request, which is the only
		// shape in which "once per refresh" and "once per request" agree. An
		// application whose handler navigates to the sign-in screen got three
		// navigations; one that reports, three reports.
		let resolveRefresh!: (value: boolean) => void;
		const refreshAuth = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolveRefresh = resolve;
				}),
		);
		const onRefreshFailed = vi.fn();
		const { transport } = unauthorizedTimes(99);
		lanka.use(lankaHttp({ auth: { refreshAuth, onRefreshFailed } }));

		const pending = [send(transport), send(transport), send(transport)];
		// Wait until all three have hit the 401 and joined the shared refresh:
		// without this the assertion would only prove the others had not arrived.
		for (let tick = 0; tick < 50 && refreshAuth.mock.calls.length === 0; tick += 1) {
			await Promise.resolve();
		}
		resolveRefresh(false);
		await Promise.allSettled(pending);

		expect(refreshAuth).toHaveBeenCalledTimes(1);
		expect(onRefreshFailed).toHaveBeenCalledTimes(1);
	});

	it("a sign-out handler that throws does not replace the server failure", async () => {
		// The caller still needs the 401 it actually got. A handler that throws must
		// not turn a failure the application can explain into one from the sign-out
		// mechanism, three layers from the cause.
		const onRefreshFailed = vi.fn(() => {
			throw new Error("navigation failed");
		});
		const { transport } = unauthorizedTimes(99);
		lanka.use(
			lankaHttp({ auth: { refreshAuth: () => Promise.resolve(false), onRefreshFailed } }),
		);

		await expect(send(transport)).rejects.toMatchObject({ status: 401 });
		expect(onRefreshFailed).toHaveBeenCalledTimes(1);
	});
	it("the next 401 after a completed refresh refreshes again", async () => {
		// The shared promise lives only while the refresh runs: otherwise a session
		// that expires an hour later would never refresh.
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		lanka.use(lankaHttp({ auth: { refreshAuth } }));

		await send(unauthorizedTimes(1).transport);
		await send(unauthorizedTimes(1).transport);

		expect(refreshAuth).toHaveBeenCalledTimes(2);
	});
});
