import { handleRequest } from "@/worker";
import { expect, jest, test } from "@jest/globals";

const env: Env = getMiniflareBindings();
const ctx: ExecutionContext = {
    waitUntil: jest.fn(),
    passThroughOnException: jest.fn()
};

console.log("env:", env);

describe("Riot API Proxy Server", () => {

    test("should return a successful response for a valid API request", async () => {
        const request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        const response = await handleRequest(request, env, ctx);

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/json;charset=utf-8");
    });

    test("should return a rate limit error for exceeding client rate limit", async () => {
        const request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        for (let i = 0; i < env.CLIENT_RATE_LIMIT_BURST + 1; i++) {
            await handleRequest(request, env, ctx);
        }

        const response = await handleRequest(request, env, ctx);

        expect(response.status).toBe(429);
    });

    test("should return a rate limit error for exceeding server rate limit", async () => {
        const request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        for (let i = 0; i < env.CLIENT_RATE_LIMIT_BURST + 1; i++) {
            await handleRequest(request, env, ctx);
        }

        const response = await handleRequest(request, env, ctx);

        expect(response.status).toBe(429);
    });

    test("should return a cached response", async () => {
        const request = new Request(
            `https://example.com/${env.DEFAULT_REGION}/lol/summoner/v4/summoners/by-name/Psychoprolapse`,
            {
                headers: {
                    "CF-Connecting-IP": "0.0.0.0"
                }
            }
        );

        const firstResponse = await handleRequest(request, env, ctx);
        expect(firstResponse.status).toBe(200);
        const firstResponseBody = await firstResponse.text();
        expect(firstResponse.headers.get("X-From-Cache")).toBe("false");

        const cachedResponse = await handleRequest(request, env, ctx);
        expect(cachedResponse.status).toBe(200);
        const cachedResponseBody = await cachedResponse.text();
        expect(cachedResponse.headers.get("X-From-Cache")).toBe("true");

        expect(firstResponseBody).toEqual(cachedResponseBody);
    });
});
