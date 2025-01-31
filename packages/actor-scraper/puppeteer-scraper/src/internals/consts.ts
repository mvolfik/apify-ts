import { Session, ProxyConfigurationOptions, PseudoUrlObject, RequestOptions } from '@crawlee/puppeteer';
import { Dictionary } from '@crawlee/utils';
import { PuppeteerLifeCycleEvent } from 'puppeteer';

/**
 * Replicates the INPUT_SCHEMA with TypeScript types for quick reference
 * and IDE type check integration.
 */
export interface Input {
    startUrls: RequestOptions[];
    pseudoUrls: PseudoUrlObject[];
    linkSelector?: string;
    clickableElementsSelector?: string;
    keepUrlFragments: boolean;
    pageFunction: string;
    preNavigationHooks?: string;
    postNavigationHooks?: string;
    proxyConfiguration: ProxyConfigurationOptions;
    proxyRotation: ProxyRotation;
    sessionPoolName?: string;
    initialCookies: Parameters<Session['setPuppeteerCookies']>[0];
    useChrome: boolean;
    ignoreSslErrors: boolean;
    ignoreCorsAndCsp: boolean;
    downloadMedia: boolean;
    downloadCss: boolean;
    maxRequestRetries: number;
    maxPagesPerCrawl: number;
    maxResultsPerCrawl: number;
    maxCrawlingDepth: number;
    maxConcurrency: number;
    pageLoadTimeoutSecs: number;
    pageFunctionTimeoutSecs: number;
    waitUntil: PuppeteerLifeCycleEvent[];
    debugLog: boolean;
    browserLog: boolean;
    customData: Dictionary;
    datasetName?: string;
    keyValueStoreName?: string;
    requestQueueName?: string;
    /**
     * @deprecated
     */
    preGotoFunction?: string;
}

export const enum ProxyRotation {
    Recommended = 'RECOMMENDED',
    PerRequest = 'PER_REQUEST',
    UntilFailure = 'UNTIL_FAILURE',
}
