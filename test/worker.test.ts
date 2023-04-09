import RATE_LIMITS, { RateLimit, Region } from "@/objects";
import { handleRequest } from "@/worker";
import { expect, jest, test } from "@jest/globals";

const env: Env = getMiniflareBindings();

console.log("worker.test: env:", env);

const ctx: ExecutionContext = {
    waitUntil: jest.fn(),
    passThroughOnException: jest.fn()
};

const rateLimit: RateLimit | undefined = RATE_LIMITS.find((item: RateLimit) =>
    item.path === "/lol/summoner/v4/summoners/by-name/:summonerName");

const clientRateLimitBurst = rateLimit!.burst * env.CLIENT_RATE_LIMIT_MULTIPLIER;

describe("Riot API Proxy Server", () => {

    test("should return a successful response for a valid API request", async () => {
        // Given
        const request: Request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        // When
        const response: Response = await handleRequest(request, env, ctx);

        // Then
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/json;charset=utf-8");
    });

    test("should return a rate limit error for exceeding client rate limit", async () => {
        // Given
        const request: Request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        // When
        for (let i: number = 0; i < clientRateLimitBurst + 1; i++) {
            await handleRequest(request, env, ctx);
        }

        const response: Response = await handleRequest(request, env, ctx);

        // Then
        expect(response.status).toBe(429);
    });

    test("should return a rate limit error for exceeding server rate limit", async () => {
        // Given
        const request: Request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        // When
        for (let i: number = 0; i < clientRateLimitBurst + 1; i++) {
            await handleRequest(request, env, ctx);
        }

        const response: Response = await handleRequest(request, env, ctx);

        // Then
        expect(response.status).toBe(429);
    });

    test("should return a cached response", async () => {
        // Given
        const request: Request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        // When
        const firstResponse: Response = await handleRequest(request, env, ctx);
        const cachedResponse: Response = await handleRequest(request, env, ctx);

        // Then
        expect(firstResponse.status).toBe(200);
        const firstResponseBody: string = await firstResponse.text();
        expect(firstResponse.headers.get("X-From-Cache")).toBe("false");

        expect(cachedResponse.status).toBe(200);
        const cachedResponseBody: string = await cachedResponse.text();
        expect(cachedResponse.headers.get("X-From-Cache")).toBe("true");

        expect(firstResponseBody).toEqual(cachedResponseBody);
    });

    test("should return an error for an invalid URL", async () => {
        // Given
        const request: Request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/nonexistent/endpoint`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        // When
        const response: Response = await handleRequest(request, env, ctx);

        // Then
        expect(response.status).toBe(500);
    });

    test("should return an error for a valid API request with a non-default region", async () => {
        // Given
        const nonDefaultRegion: Region = Region.NA1;
        const request: Request = new Request(
            `https://example.com/${nonDefaultRegion}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        // When
        const response: Response = await handleRequest(request, env, ctx);

        // Then
        expect(response.status).toBe(500);
        expect(response.headers.get("Content-Type")).toBe("text/plain;charset=UTF-8");
    });

    test("should return an error when an invalid region is provided", async () => {
        // Given
        const invalidRegion: string = "INVALID_REGION";
        const request: Request = new Request(
            `https://example.com/${invalidRegion}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        // When
        const response: Response = await handleRequest(request, env, ctx);

        // Then
        expect(response.status).toBe(500);
        expect(response.headers.get("Content-Type")).toBe("text/plain;charset=UTF-8");
    });
});
