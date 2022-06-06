import {
    BrowserCrawler,
    BrowserCrawlerHandleRequest,
    BrowserCrawlerOptions,
    BrowserCrawlingContext,
    BrowserHook,
} from '@crawlee/browser';
import { BrowserPoolOptions, PuppeteerPlugin } from '@crawlee/browser-pool';
import ow from 'ow';
import { HTTPResponse, LaunchOptions, Page } from 'puppeteer';
import { PuppeteerLaunchContext, PuppeteerLauncher } from './puppeteer-launcher';
import { DirectNavigationOptions, gotoExtended, PuppeteerContextUtils, registerUtilsToContext } from './utils/puppeteer_utils';

export type PuppeteerController = ReturnType<PuppeteerPlugin['_createController']>;
export type PuppeteerCrawlingContext = BrowserCrawlingContext<Page, HTTPResponse, PuppeteerController> & PuppeteerContextUtils;
export type PuppeteerHook = BrowserHook<PuppeteerCrawlingContext, PuppeteerGoToOptions>;
export type PuppeteerRequestHandler = BrowserCrawlerHandleRequest<PuppeteerCrawlingContext>;
export type PuppeteerGoToOptions = Parameters<Page['goto']>[1];

export interface PuppeteerCrawlerOptions extends BrowserCrawlerOptions<
    PuppeteerCrawlingContext,
    { browserPlugins: [PuppeteerPlugin] }
> {
    /**
     * Options used by {@link launchPuppeteer} to start new Puppeteer instances.
     */
    launchContext?: PuppeteerLaunchContext;

    /**
     * Async functions that are sequentially evaluated before the navigation. Good for setting additional cookies
     * or browser properties before navigation. The function accepts two parameters, `crawlingContext` and `gotoOptions`,
     * which are passed to the `page.goto()` function the crawler calls to navigate.
     * Example:
     * ```
     * preNavigationHooks: [
     *     async (crawlingContext, gotoOptions) => {
     *         const { page } = crawlingContext;
     *         await page.evaluate((attr) => { window.foo = attr; }, 'bar');
     *     },
     * ]
     * ```
     */
    preNavigationHooks?: PuppeteerHook[];

    /**
     * Async functions that are sequentially evaluated after the navigation. Good for checking if the navigation was successful.
     * The function accepts `crawlingContext` as the only parameter.
     * Example:
     * ```
     * postNavigationHooks: [
     *     async (crawlingContext) => {
     *         const { page } = crawlingContext;
     *         if (hasCaptcha(page)) {
     *             await solveCaptcha (page);
     *         }
     *     },
     * ]
     * ```
     */
    postNavigationHooks?: PuppeteerHook[];
}

/**
 * Provides a simple framework for parallel crawling of web pages
 * using headless Chrome with [Puppeteer](https://github.com/puppeteer/puppeteer).
 * The URLs to crawl are fed either from a static list of URLs
 * or from a dynamic queue of URLs enabling recursive crawling of websites.
 *
 * Since `PuppeteerCrawler` uses headless Chrome to download web pages and extract data,
 * it is useful for crawling of websites that require to execute JavaScript.
 * If the target website doesn't need JavaScript, consider using {@link CheerioCrawler},
 * which downloads the pages using raw HTTP requests and is about 10x faster.
 *
 * The source URLs are represented using {@link Request} objects that are fed from
 * {@link RequestList} or {@link RequestQueue} instances provided by the {@link PuppeteerCrawlerOptions.requestList}
 * or {@link PuppeteerCrawlerOptions.requestQueue} constructor options, respectively.
 *
 * If both {@link PuppeteerCrawlerOptions.requestList} and {@link PuppeteerCrawlerOptions.requestQueue} are used,
 * the instance first processes URLs from the {@link RequestList} and automatically enqueues all of them
 * to {@link RequestQueue} before it starts their processing. This ensures that a single URL is not crawled multiple times.
 *
 * The crawler finishes when there are no more {@link Request} objects to crawl.
 *
 * `PuppeteerCrawler` opens a new Chrome page (i.e. tab) for each {@link Request} object to crawl
 * and then calls the function provided by user as the {@link PuppeteerCrawlerOptions.handlePageFunction} option.
 *
 * New pages are only opened when there is enough free CPU and memory available,
 * using the functionality provided by the {@link AutoscaledPool} class.
 * All {@link AutoscaledPool} configuration options can be passed to the {@link PuppeteerCrawlerOptions.autoscaledPoolOptions}
 * parameter of the `PuppeteerCrawler` constructor. For user convenience, the `minConcurrency` and `maxConcurrency`
 * {@link AutoscaledPoolOptions} are available directly in the `PuppeteerCrawler` constructor.
 *
 * Note that the pool of Puppeteer instances is internally managed by the [BrowserPool](https://github.com/apify/browser-pool) class.
 *
 * **Example usage:**
 *
 * ```javascript
 * const crawler = new PuppeteerCrawler({
 *     requestList,
 *     handlePageFunction: async ({ page, request }) => {
 *         // This function is called to extract data from a single web page
 *         // 'page' is an instance of Puppeteer.Page with page.goto(request.url) already called
 *         // 'request' is an instance of Request class with information about the page to load
 *         await Actor.pushData({
 *             title: await page.title(),
 *             url: request.url,
 *             succeeded: true,
 *         })
 *     },
 *     handleFailedRequestFunction: async ({ request }) => {
 *         // This function is called when the crawling of a request failed too many times
 *         await Actor.pushData({
 *             url: request.url,
 *             succeeded: false,
 *             errors: request.errorMessages,
 *         })
 *     },
 * });
 *
 * await crawler.run();
 * ```
 * @category Crawlers
 */
export class PuppeteerCrawler extends BrowserCrawler<{ browserPlugins: [PuppeteerPlugin] }, LaunchOptions, PuppeteerCrawlingContext> {
    protected static override optionsShape = {
        ...BrowserCrawler.optionsShape,
        browserPoolOptions: ow.optional.object,
    };

    /**
     * All `PuppeteerCrawler` parameters are passed via an options object.
     */
    constructor(options: PuppeteerCrawlerOptions) {
        ow(options, 'PuppeteerCrawlerOptions', ow.object.exactShape(PuppeteerCrawler.optionsShape));

        const {
            launchContext = {},
            browserPoolOptions = {} as BrowserPoolOptions,
            proxyConfiguration,
            ...browserCrawlerOptions
        } = options;

        if (launchContext.proxyUrl) {
            throw new Error('PuppeteerCrawlerOptions.launchContext.proxyUrl is not allowed in PuppeteerCrawler.'
                + 'Use PuppeteerCrawlerOptions.proxyConfiguration');
        }

        const puppeteerLauncher = new PuppeteerLauncher(launchContext);

        browserPoolOptions.browserPlugins = [
            puppeteerLauncher.createBrowserPlugin(),
        ];

        super({ ...browserCrawlerOptions, launchContext, proxyConfiguration, browserPoolOptions });
    }

    protected override async _runRequestHandler(context: PuppeteerCrawlingContext) {
        registerUtilsToContext(context);
        // eslint-disable-next-line no-underscore-dangle
        await super._runRequestHandler(context);
    }

    protected override async _navigationHandler(crawlingContext: PuppeteerCrawlingContext, gotoOptions: DirectNavigationOptions) {
        return gotoExtended(crawlingContext.page, crawlingContext.request, gotoOptions);
    }
}
