/**
 * Rate limiter init
 * 
 * @param key The key to use for the rate limit
 * @param rateLimitKv The KV store to use for the rate limit
 * @param rateLimitBurst The number of requests allowed in the rate limit interval
 * @param rateLimitInterval The rate limit interval in milliseconds
 * @constructor
 * @example
 * const rateLimiterInit: RateLimiterInit = {
 *     key: `${ip}:${urlString}`,
 *     rateLimitKv: env.RATE_LIMIT_KV,
 *     rateLimitBurst: env.RATE_LIMIT_BURST,
 *     rateLimitInterval: env.RATE_LIMIT_INTERVAL
 * };
 */
export interface RateLimiterInit {
    key: string;
    rateLimitKv: KVNamespace;
    rateLimitBurst: number;
    rateLimitInterval: number;
}

export class RateLimitInfo {
    readonly timestamps: number[] = [];

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
    constructor(timestamps: number[] = []) {
        this.timestamps.push(...timestamps);
    }

    add(currentTime: number) {
        this.timestamps.push(currentTime);
    }
}

class TimeInterval {
    readonly seconds: number;
    private _milliseconds: number;

    /**
     * Time interval
     * 
     * @param seconds The time interval in seconds
     * @constructor
     * @example
     * const timeInterval: TimeInterval = new TimeInterval(60);
     * timeInterval.seconds; // 60
     * timeInterval.milliseconds; // 60000
     */
    constructor(seconds: number) {
        this.seconds = seconds;
        this._milliseconds = seconds * 1000;
    }

    get milliseconds(): number {
        return this._milliseconds;
    }
}

export class RateLimiter {

    readonly key: string;
    readonly rateLimitKv: KVNamespace;
    readonly rateLimitBurst: number; // number of requests
    readonly rateLimitInterval: TimeInterval;
    readonly requestTimestamp: number;

    /**
     * Rate limiter
     * 
     * A rate limiter that uses a KV store to track the number of
     * requests in a given interval and limits the number of requests to
     * a given burst size in that interval for a given key (e.g. IP address)
     * and returns true if the rate limit has not been exceeded and false otherwise.
     * The rate limit is reset after the interval has elapsed since the last request.
     * Also this rate limiter does not use a sliding window and
     * only tracks the number of requests in the interval.
     * 
     * @param init The rate limiter init
     * @returns The rate limiter
     * @constructor
     * @example
     * const incomingRateLimiterInit = {
     *     key: `in:${ip}:${riotAPIUrlString}`,
     *     rateLimitKv: env.RATE_LIMIT_KV,
     *     rateLimitBurst: env.CLIENT_RATE_LIMIT_BURST,
     *     rateLimitInterval: env.CLIENT_RATE_LIMIT_INTERVAL
     * };
     * const incomingRateLimiter = new RateLimiter(incomingRateLimiterInit);
     * if (!await incomingRateLimiter.isAllowed()) {
     *     console.error("handleRequest: client rate limit exceeded");
     *     return new Response('Rate limit exceeded', { status: 429 });
     * }
     * @example
     * const outgoingRateLimiterInit = {
     *     key: `out:${riotAPIUrlString}`,
     *     rateLimitKv: env.RATE_LIMIT_KV,
     *     rateLimitBurst: env.SERVER_RATE_LIMIT_BURST,
     *     rateLimitInterval: env.SERVER_RATE_LIMIT_INTERVAL
     * };
     * const outgoingRateLimiter = new RateLimiter(outgoingRateLimiterInit);
     * if (!await outgoingRateLimiter.isAllowed()) {
     *     console.error("handleRequest: server rate limit exceeded");
     *     return new Response('Rate limit exceeded', { status: 429 });
     * }
     */
    constructor(
        init: RateLimiterInit,
        requestTimestamp: number = Date.now()
    ) {
        this.key = init.key;
        this.rateLimitKv = init.rateLimitKv;
        this.rateLimitBurst = init.rateLimitBurst;
        this.rateLimitInterval = new TimeInterval(init.rateLimitInterval);
        this.requestTimestamp = requestTimestamp;
    }

    /**
     * Checks if the rate limit has been exceeded
     * @returns True if the rate limit has not been exceeded, false otherwise
     */
    async isAllowed(): Promise<boolean> {
        try {
            const rateLimitInfo: RateLimitInfo = await this.getRateLimitInfo();
            console.log("rateLimiter: rateLimitInfo:", rateLimitInfo);
            console.log("rateLimiter: currentTime:", this.requestTimestamp);

            // Remove expired requests from the list
            const filteredInfo: number[] = rateLimitInfo.timestamps.filter(
                (timestamp) => (this.requestTimestamp - timestamp) < this.rateLimitInterval.milliseconds
            );
            console.log("rateLimiter: filteredInfo:", filteredInfo);
            const filteredRateLimitInfo = new RateLimitInfo(filteredInfo);
            console.log("rateLimiter: filteredRateLimitInfo:", filteredRateLimitInfo);

            if (filteredRateLimitInfo.timestamps.length >= this.rateLimitBurst) {
                console.error("rateLimiter: rate limit exceeded");
                return false;
            }

            // Add the current request timestamp
            filteredRateLimitInfo.add(this.requestTimestamp);
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
            const valueString: string | null = await this.rateLimitKv.get(this.key);
            console.log("getRateLimitInfo: valueString:", valueString);
            const value: number[] = this.getValue(valueString);
            console.log("getRateLimitInfo: value:", value);
            return new RateLimitInfo(value);
        } catch (error) {
            console.error("getRateLimitInfo: error:", error);
            throw new Error(`getRateLimitInfo: error: ${error}`);
        } finally {
            console.log("getRateLimitInfo: done");
        }
    }

    /**
     * Gets the value from the KV store
     * @param valueString The value string
     * @returns The value
     * @throws Error if the value is not an array
     */
    private getValue(valueString: string | null): number[] {
        let value: any;
        if (valueString) {
            value = JSON.parse(valueString);
            console.log("getValue: value:", value);
        } else {
            console.log("getValue: value is null");
            value = [];
        }
        if (!Array.isArray(value)) {
            console.error("getValue: value is not an array");
            throw new Error("getValue: value is not an array");
        }
        return value as number[];
    }

    /**
     * Updates the rate limit info in the KV store
     * @param rateLimitInfo The rate limit info
     * @returns Nothing
     */
    private async updateRateLimitInfo(rateLimitInfo: RateLimitInfo): Promise<void> {
        try {
            const expirationTtl: number = Math.max(60, this.rateLimitInterval.seconds);
            const kvNamespacePutOptions: KVNamespacePutOptions = { expirationTtl };
            const valueString: string = JSON.stringify(rateLimitInfo.timestamps);
            await this.rateLimitKv.put(this.key, valueString, kvNamespacePutOptions);
        } catch (error) {
            console.error("updateRateLimitInfo: error:", error);
            throw new Error(`updateRateLimitInfo: error: ${error}`);
        }
    }
}
