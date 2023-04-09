import { rateLimits as RATE_LIMITS_JSON } from "../riot-api-rate-limits.json";

export enum Region {
    BR1 = "br1",
    EUN1 = "eun1",
    EUW1 = "euw1",
    JP1 = "jp1",
    KR = "kr",
    LA1 = "la1",
    LA2 = "la2",
    NA1 = "na1",
    OC1 = "oc1",
    PH2 = "ph2",
    RU = "ru",
    SG2 = "sg2",
    TH2 = "th2",
    TR1 = "tr1",
    TW2 = "tw2",
    VN2 = "vn2",
}

export interface RateLimit {
    method: string;
    path: string;
    burst: number;
    interval: number;
}

export interface RateLimits {
    rateLimits: RateLimit[];
}

const RATE_LIMITS: RateLimit[] = RATE_LIMITS_JSON;

export default RATE_LIMITS;
