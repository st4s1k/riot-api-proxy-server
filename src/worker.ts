import { Region } from "./objects";
import { RateLimiter } from "./rate-limiter";

/**
 * Converts the incoming request to a Riot API request
 * @param request The incoming request
 * @returns The Riot API request
 */
addEventListener('fetch', (event: FetchEvent) => {
    event.respondWith(handleRequest(event.request, event));
});

/**
 * Handles incoming requests
 * @param request The incoming request
 * @param event The FetchEvent
 * @returns The response
 */
export async function handleRequest(request: Request, event: FetchEvent): Promise<Response> {
    try {
        console.log("handleRequest: request:", request);

        const ip: string | null = request.headers.get("CF-Connecting-IP");
        console.log("handleRequest: ip:", ip);

        if (!ip) {
            console.error("handleRequest: error getting IP address");
            return new Response('Error getting IP address', { status: 500 /* Internal Server Error */ });
        }

        // Check the rate limit for the client and return an error if exceeded
        const incomingRateLimiter = new RateLimiter(ip);
        if (!await incomingRateLimiter.isAllowed()) {
            console.error("handleRequest: client rate limit exceeded");
            return new Response('Rate limit exceeded', { status: 429 /* Too Many Requests */ });
        }

        // Check the rate limit for the server and return an error if exceeded
        const outgoingRateLimiter = new RateLimiter("outgoing_requests");
        if (!await outgoingRateLimiter.isAllowed()) {
            console.error("handleRequest: server rate limit exceeded");
            return new Response('Rate limit exceeded', { status: 429 /* Too Many Requests */ });
        }

        // Convert the incoming request to a Riot API request
        const riotAPIUrl: URL = convertToRiotAPIUrl(request);
        console.log("handleRequest: riotAPIUrl:", riotAPIUrl);
        const riotAPIUrlString: string = riotAPIUrl.toString();
        console.log("handleRequest: riotAPIUrlString:", riotAPIUrlString);

        // Check the cache for a matching request and return it if found
        const headers: HeadersInit = {
            'X-Riot-Token': API_KEY
        }
        const cacheKey: Request = new Request(riotAPIUrlString, { headers });
        console.log("handleRequest: cacheKey:", cacheKey);
        const cacheResponse: Response | undefined = await caches.default.match(cacheKey);
        console.log("handleRequest: cacheResponse:", cacheResponse);

        if (cacheResponse) {
            console.log("handleRequest: returning cached response");
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
            response.headers.set("Cache-Control", `public, max-age=${CACHE_DURATION}`);
            event.waitUntil(caches.default.put(cacheKey, response.clone()));
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
export function convertToRiotAPIUrl(request: Request<unknown, CfProperties<unknown>>): URL {
    const url: URL = new URL(request.url);
    console.log("convertToRiotAPIUrl: url:", url);
    const region: Region = extractRegion(url);
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
export function extractRegion(url: URL): Region {
    try {
        const extractedRegion: string = url.pathname.split('/')[1].toUpperCase();
        const regionValues: Region[] = Object.values(Region);

        if (regionValues.includes(extractedRegion as Region)) {
            console.log("extractRegion: using region from URL");
            return extractedRegion as Region;
        } else {
            console.log("extractRegion: region not found in URL");
            return getDefaultRegion();;
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
 * @returns The default region
 * @throws Error if the default region is invalid
 */
export function getDefaultRegion(): Region {
    const regionValues: Region[] = Object.values(Region);
    if (regionValues.includes(DEFAULT_REGION as Region)) {
        console.log("validateRegion: using default region");
        return DEFAULT_REGION as Region;
    } else {
        console.error("validateRegion: invalid default region: DEFAULT_REGION:", DEFAULT_REGION);
        throw new Error(`validateRegion: invalid default region: DEFAULT_REGION: ${DEFAULT_REGION}`);
    }
}
