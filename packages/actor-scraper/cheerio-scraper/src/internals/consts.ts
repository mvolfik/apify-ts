import { ProxyConfigurationOptions, PseudoUrlInput, RequestOptions, Session } from '@crawlee/core';
import { Dictionary } from '@crawlee/utils';

/**
 * Replicates the INPUT_SCHEMA with JavaScript types for quick reference
 * and IDE type check integration.
 */
export interface Input {
    startUrls: RequestOptions[];
    pseudoUrls: PseudoUrlInput[];
    keepUrlFragments: boolean;
    linkSelector?: string;
    pageFunction: string;
    preNavigationHooks?: string;
    postNavigationHooks?: string;
    proxyConfiguration: ProxyConfigurationOptions;
    proxyRotation: ProxyRotation;
    sessionPoolName?: string;
    initialCookies: Parameters<Session['setPuppeteerCookies']>[0];
    additionalMimeTypes: string[];
    suggestResponseEncoding?: string;
    forceResponseEncoding: boolean;
    ignoreSslErrors: boolean;
    maxRequestRetries: number;
    maxPagesPerCrawl: number;
    maxResultsPerCrawl: number;
    maxCrawlingDepth: number;
    maxConcurrency: number;
    pageLoadTimeoutSecs: number;
    pageFunctionTimeoutSecs: number;
    debugLog: boolean;
    customData: Dictionary;
    datasetName?: string;
    keyValueStoreName?: string;
    requestQueueName?: string;
}

export const enum ProxyRotation {
    Recommended = 'RECOMMENDED',
    PerRequest = 'PER_REQUEST',
    UntilFailure = 'UNTIL_FAILURE',
}
