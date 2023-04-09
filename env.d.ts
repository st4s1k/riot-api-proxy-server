interface Env {
    API_KEY: string;
    DEFAULT_REGION: string;
    CACHE_DURATION: number;
    RATE_LIMIT_KV: KVNamespace;
    CLIENT_RATE_LIMIT_MULTIPLIER: number;
}
