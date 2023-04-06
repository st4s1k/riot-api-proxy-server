/**
 * Rate limit info
 * 
 * @param timestamps The timestamps of the requests
 * @constructor
 * @example
 * const rateLimitInfo = new RateLimitInfo();
 * @example
 * const rateLimitInfo = new RateLimitInfo([1234567890, 1234567891]);
 */
export class RateLimitInfo {
    private _timestamps: number[];

    constructor(timestamps: number[] = []) {
        this._timestamps = timestamps;
    }

    get timestamps(): number[] {
        return this._timestamps;
    }

    add(currentTime: number) {
        this._timestamps.push(currentTime);
    }
}

/**
 * Rate limiter
 * A rate limiter that uses a KV store to track the number of
 * requests in a given interval and limits the number of requests to
 * a given burst size in that interval for a given key (e.g. IP address)
 * and returns true if the rate limit has not been exceeded and false otherwise.
 * The rate limit is reset after the interval has elapsed since the last request.
 * Also this rate limiter does not use a sliding window and
 * only tracks the number of requests in the interval.
 * 
 * @param key The key to use for the rate limit
 * @param rateLimitBurst The number of requests allowed in the rate limit interval
 * @param rateLimitInterval The rate limit interval in milliseconds
 * @returns The rate limiter
 * @constructor
 * @example
 * const rateLimiter = new RateLimiter("outgoing_requests");
 * if (!await rateLimiter.isAllowed()) {
 *    console.error("handleRequest: server rate limit exceeded");
 *    return new Response('Rate limit exceeded', { status: 429 /* Too Many Requests *\/ });
 * }
 * @example
 * const rateLimiter = new RateLimiter(ip);
 * if (!await rateLimiter.isAllowed()) {
 *   console.error("handleRequest: client rate limit exceeded");
 *   return new Response('Rate limit exceeded', { status: 429 /* Too Many Requests *\/ });
 * }
 * @example
 * const rateLimiter = new RateLimiter(ip, 10, 1000);
 * if (!await rateLimiter.isAllowed()) {
 *  console.error("handleRequest: client rate limit exceeded");
 *  return new Response('Rate limit exceeded', { status: 429 /* Too Many Requests *\/ });
 * }
 */
export class RateLimiter {
    private _key: string;
    private _rateLimitBurst: number;
    private _rateLimitInterval: number;

    constructor(
        key: string,
        rateLimitBurst: number = RATE_LIMIT_BURST,
        rateLimitInterval: number = RATE_LIMIT_INTERVAL
    ) {
        this._key = key;
        this._rateLimitBurst = rateLimitBurst;
        this._rateLimitInterval = rateLimitInterval;
    }

    /**
     * Checks if the rate limit has been exceeded
     * @returns True if the rate limit has not been exceeded, false otherwise
     */
    async isAllowed(): Promise<boolean> {
        try {
            const rateLimitInfo: RateLimitInfo = await this.getRateLimitInfo();
            console.log("rateLimiter: rateLimitInfo:", rateLimitInfo);
            const currentTime: number = Date.now();
            console.log("rateLimiter: currentTime:", currentTime);

            // Remove expired requests from the list
            const filteredInfo: number[] = rateLimitInfo.timestamps.filter(
                (timestamp) => currentTime - timestamp < this._rateLimitInterval
            );
            console.log("rateLimiter: filteredInfo:", filteredInfo);
            const filteredRateLimitInfo = new RateLimitInfo(filteredInfo);
            console.log("rateLimiter: filteredRateLimitInfo:", filteredRateLimitInfo);

            if (filteredRateLimitInfo.timestamps.length >= this._rateLimitBurst) {
                console.error("rateLimiter: rate limit exceeded");
                return false;
            }

            // Add the current request timestamp
            filteredRateLimitInfo.add(currentTime);
            await this.updateRateLimitInfo(filteredRateLimitInfo);
            return true;
        } catch (error) {
            console.error("rateLimiter: error:", error);
            throw new Error(`rateLimiter: error: ${error}`);
        }
    }

    /**
     * Gets the rate limit info from the KV store
     * @returns The rate limit info
     */
    private async getRateLimitInfo(): Promise<RateLimitInfo> {
        try {
            let value: number[] | null = null;
            const valueString: string | null = await RATE_LIMIT_KV.get(this._key);
            console.log("getRateLimitInfo: valueString:", valueString);
            if (valueString) {
                value = JSON.parse(valueString);
                console.log("getRateLimitInfo: value:", value);
            } else {
                value = [];
                console.log("getRateLimitInfo: value is null");
            }
            if (!Array.isArray(value)) {
                console.error("getRateLimitInfo: value is not an array");
                throw new Error("getRateLimitInfo: value is not an array");
            }
            return new RateLimitInfo(value);
        } catch (error) {
            console.error("getRateLimitInfo: error:", error);
            throw new Error(`getRateLimitInfo: error: ${error}`);
        }
    }

    /**
     * Updates the rate limit info in the KV store
     * @param rateLimitInfo The rate limit info
     * @returns Nothing
     */
    private async updateRateLimitInfo(rateLimitInfo: RateLimitInfo): Promise<void> {
        try {
            await RATE_LIMIT_KV.put(this._key, JSON.stringify(rateLimitInfo.timestamps), { expirationTtl: 61 });
        } catch (error) {
            // ignore - as the KV threshold may exceed
            console.error("updateRateLimitInfo: error:", error);
            throw new Error(`updateRateLimitInfo: error: ${error}`);
        }
    }
}
