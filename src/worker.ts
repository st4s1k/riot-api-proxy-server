import { Region } from "@/objects";
import { RateLimiter, RateLimiterInit } from "@/rate-limiter";

/**
 * Handles incoming request
 * @param request The incoming request
 * @param env The environment variables
 * @param ctx The execution context
 * @returns The response
 */
export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
        console.log("handleRequest: request:", request);

        const ip: string | null = request.headers.get("CF-Connecting-IP");
        console.log("handleRequest: ip:", ip);

        if (!ip) {
            console.error("handleRequest: error getting IP address");
            return new Response("Error getting IP address", { status: 500 /* Internal Server Error */ });
        }

        // Convert the incoming request to a Riot API request
        const riotAPIUrl: URL = convertToRiotAPIUrl(request, env);
        console.log("handleRequest: riotAPIUrl:", riotAPIUrl);
        const riotAPIUrlString: string = riotAPIUrl.toString();
        console.log("handleRequest: riotAPIUrlString:", riotAPIUrlString);
        const headers: HeadersInit = {
            "X-Riot-Token": env.API_KEY,
            "User-Agent": "RiotAPIProxy/1.0.0 (https://github.com/st4s1k/riot-api-proxy-server)"
        };

        // Check the rate limit for the client and return an error if exceeded
        const incomingRateLimiterInit: RateLimiterInit = {
            key: `in:${ip}:${riotAPIUrlString}`,
            rateLimitKv: env.RATE_LIMIT_KV,
            rateLimitBurst: env.CLIENT_RATE_LIMIT_BURST,
            rateLimitInterval: env.CLIENT_RATE_LIMIT_INTERVAL
        };
        const incomingRateLimiter = new RateLimiter(incomingRateLimiterInit);
        if (!await incomingRateLimiter.isAllowed()) {
            console.error("handleRequest: client rate limit exceeded");
            return new Response("Rate limit exceeded", { status: 429 /* Too Many Requests */ });
        }

        // Check the rate limit for the server and return an error if exceeded
        const outgoingRateLimiterInit: RateLimiterInit = {
            key: `out:${riotAPIUrlString}`,
            rateLimitKv: env.RATE_LIMIT_KV,
            rateLimitBurst: env.SERVER_RATE_LIMIT_BURST,
            rateLimitInterval: env.SERVER_RATE_LIMIT_INTERVAL
        };
        const outgoingRateLimiter = new RateLimiter(outgoingRateLimiterInit);
        if (!await outgoingRateLimiter.isAllowed()) {
            console.error("handleRequest: server rate limit exceeded");
            return new Response("Rate limit exceeded", { status: 429 /* Too Many Requests */ });
        }

        // Check the cache for a matching request and return it if found
        console.log("handleRequest: cacheKey:", riotAPIUrlString);
        const cacheResponse: Response | undefined = await caches.default.match(riotAPIUrlString);
        console.log("handleRequest: cacheResponse:", cacheResponse);

        if (cacheResponse) {
            console.log("handleRequest: returning cached response: cacheResponse:", cacheResponse);
            return cacheResponse;
        }

        // Forward the request to the Riot API
        let apiResponse: Response;
        try {
            apiResponse = await fetch(riotAPIUrlString, {
                method: request.method,
                headers: headers,
                body: request.body
            });
            console.log("handleRequest: apiResponse:", apiResponse);
        } catch (error) {
            console.error("handleRequest: error:", error);
            return new Response("Error fetching data from Riot API", { status: 500 /* Internal Server Error */ });
        }

        // Forward the response to the client
        const responseInit = {
            status: apiResponse.status,
            statusText: apiResponse.statusText,
            headers: apiResponse.headers,
        };
        const response: Response = new Response(apiResponse.body, responseInit);

        if (apiResponse.status === 200) {
            // Cache successful responses
            response.headers.set("Cache-Control", `public, max-age=${env.CACHE_DURATION}`);

            const responseToCache = response.clone();
            responseToCache.headers.set("X-From-Cache", "true");
            ctx.waitUntil(caches.default.put(riotAPIUrlString, responseToCache));

            response.headers.set("X-From-Cache", "false");
        }

        return response;
    } catch (error) {
        console.error("handleRequest: error:", error);
        return new Response(`Error: ${error}`, { status: 500 /* Internal Server Error */ });
    } finally {
        console.log("handleRequest: done");
    }
}

/**
 * Converts the incoming request to a Riot API request
 * @param request The incoming request
 * @returns The converted request
 */
export function convertToRiotAPIUrl(request: Request<unknown, CfProperties<unknown>>, env: Env): URL {
    const url: URL = new URL(request.url);
    console.log("convertToRiotAPIUrl: url:", url);
    const region: Region = extractRegion(url, env);
    console.log("convertToRiotAPIUrl: region:", region);

    if (url.pathname.startsWith(`/${region}`)) {
        url.pathname = url.pathname.substring(region.length + 1);
    }

    url.hostname = `${region}.api.riotgames.com`;

    return url;
}

/**
 * Extracts the region from the incoming request
 * @param url The incoming request
 * @returns The extracted region
 */
export function extractRegion(url: URL, env: Env): Region {
    try {
        const extractedRegion: string = url.pathname.split("/")[1].toUpperCase();
        const regionValues: Region[] = Object.values(Region);

        if (regionValues.includes(extractedRegion as Region)) {
            console.log("extractRegion: using region from URL: extractedRegion:", extractedRegion);
            return extractedRegion as Region;
        } else {
            console.log("extractRegion: region not found in URL: extractedRegion:", extractedRegion);
            return getDefaultRegion(env);
        }
    } catch (error) {
        console.error("extractRegion: error:", error);
        throw new Error(`extractRegion: error: ${error}`);
    } finally {
        console.log("extractRegion: done");
    }
}


/**
 * Gets the default region from the environment variable DEFAULT_REGION
 * @param env The environment variables
 * @returns The default region
 * @throws Error if the default region is invalid
 */
export function getDefaultRegion(env: Env): Region {
    const regionValues: Region[] = Object.values(Region);
    if (regionValues.includes(env.DEFAULT_REGION as Region)) {
        console.log("getDefaultRegion: using default region");
        return env.DEFAULT_REGION as Region;
    } else {
        console.error("getDefaultRegion: invalid default region: DEFAULT_REGION:", env.DEFAULT_REGION);
        throw new Error(`getDefaultRegion: invalid default region: DEFAULT_REGION: ${env.DEFAULT_REGION}`);
    }
}

const worker: ExportedHandler<Env> = { fetch: handleRequest };

export default worker;
