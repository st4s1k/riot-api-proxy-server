import { RateLimiter, RateLimiterInit, RateLimitInfo } from "@/rate-limiter";
import { expect, jest, test } from "@jest/globals";

const env: Env = getMiniflareBindings();

type KVPutFn = jest.SpiedFunction<(key: string, value: string, options?: KVNamespacePutOptions | undefined) => Promise<void>>;
type KVGetFn = jest.SpiedFunction<(key: string) => Promise<any | null>>;

console.log("rate-limiter.test: env:", env);

const rateLimiterInit: RateLimiterInit = {
    key: "test-key",
    rateLimitKv: env.RATE_LIMIT_KV,
    rateLimitBurst: 5,
    rateLimitInterval: 60
};

describe("RateLimiter", () => {
    afterEach(async () => {
        await rateLimiterInit.rateLimitKv.delete(rateLimiterInit.key);
        jest.clearAllMocks();
        jest.resetModules();
    });

    test("should initialize correctly with given parameters", () => {
        // Given
        const rateLimiter: RateLimiter = new RateLimiter(rateLimiterInit, Date.now());

        // Then
        expect(rateLimiter.key).toBe(rateLimiterInit.key);
        expect(rateLimiter.rateLimitKv).toBe(rateLimiterInit.rateLimitKv);
        expect(rateLimiter.rateLimitBurst).toBe(rateLimiterInit.rateLimitBurst);
        expect(rateLimiter.rateLimitInterval.seconds).toBe(rateLimiterInit.rateLimitInterval);
    });

    test("should allow requests below rate limit", async () => {
        // Given
        const rateLimiter: RateLimiter = new RateLimiter(rateLimiterInit, Date.now());

        const rateLimitKvPutSpy: KVPutFn = jest.spyOn(rateLimiter.rateLimitKv, "put");
        const rateLimitKvGetSpy: KVGetFn = jest.spyOn(rateLimiter.rateLimitKv, "get");

        // When
        const isAllowed: boolean = await rateLimiter.isAllowed();

        // Then
        expect(isAllowed).toBe(true);

        expect(rateLimitKvGetSpy).toHaveBeenCalledWith(rateLimiter.key);
        expect(rateLimitKvPutSpy).toHaveBeenCalledWith(
            rateLimiter.key,
            JSON.stringify([rateLimiter.requestTimestamp]),
            { expirationTtl: 60 }
        );
    });

    test("should not allow requests exceeding rate limit", async () => {
        // Given
        const requestTimestamp: number = Date.now() + 1000;
        const rateLimiter: RateLimiter = new RateLimiter(rateLimiterInit, requestTimestamp);

        const timestamps: number[] = [];
        for (let i = 0; i < rateLimiter.rateLimitBurst; i++) {
            timestamps.push(Date.now() + i);
        }

        const timestampsString: string = JSON.stringify(timestamps);

        await rateLimiter.rateLimitKv.put(rateLimiter.key, timestampsString);

        const rateLimitKvPutSpy: KVPutFn = jest.spyOn(rateLimiter.rateLimitKv, "put");
        const rateLimitKvGetSpy: KVGetFn = jest.spyOn(rateLimiter.rateLimitKv, "get");

        (rateLimitKvPutSpy as jest.Mock).mockClear();

        // When
        const isAllowed: boolean = await rateLimiter.isAllowed();

        // Then
        expect(isAllowed).toBe(false);

        expect(rateLimitKvGetSpy).toHaveBeenCalledWith(rateLimiter.key);
        expect(rateLimitKvPutSpy).not.toHaveBeenCalled();
    });

    test("should update rate limit info in KV store", async () => {
        // Given
        const rateLimiter: RateLimiter = new RateLimiter(rateLimiterInit, Date.now());

        const rateLimitKvPutSpy: KVPutFn = jest.spyOn(rateLimiter.rateLimitKv, "put");
        const rateLimitKvGetSpy: KVGetFn = jest.spyOn(rateLimiter.rateLimitKv, "get");

        // When
        await rateLimiter.isAllowed();

        // Then
        expect(rateLimitKvGetSpy).toHaveBeenCalledWith(rateLimiter.key);
        expect(rateLimitKvPutSpy).toHaveBeenCalledWith(
            rateLimiter.key,
            JSON.stringify([rateLimiter.requestTimestamp]),
            { expirationTtl: 60 }
        );
    });

    test("RateLimitInfo constructor initializes timestamps correctly", () => {
        // Given
        const timestamps: number[] = [Date.now(), Date.now() + 1000];
        const rateLimitInfo: RateLimitInfo = new RateLimitInfo(timestamps);

        // Then
        expect(rateLimitInfo.timestamps).toEqual(timestamps);
    });

    test("RateLimitInfo add method should add timestamp", () => {
        // Given
        const timestamps: number[] = [Date.now(), Date.now() + 1000];
        const rateLimitInfo: RateLimitInfo = new RateLimitInfo(timestamps);
        const newTimestamp: number = Date.now() + 2000;

        // When
        rateLimitInfo.add(newTimestamp);

        // Then
        expect(rateLimitInfo.timestamps).toEqual([...timestamps, newTimestamp]);
    });
});
