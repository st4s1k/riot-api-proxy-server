/* eslint-disable no-var */

declare global {
    const API_KEY: string;
    const DEFAULT_REGION: string;
    const RATE_LIMIT_KV: KVNamespace;
    const RATE_LIMIT_BURST: number;
    const RATE_LIMIT_INTERVAL: number;
    const CACHE_DURATION: number;
}

export {};
