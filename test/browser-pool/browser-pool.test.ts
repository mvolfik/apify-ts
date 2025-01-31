/* eslint-disable dot-notation -- Accessing private properties */
import { AddressInfo } from 'net';
import http from 'http';
import { promisify } from 'util';
import { Server as ProxyChainServer } from 'proxy-chain';
import puppeteer, { Page } from 'puppeteer';
import playwright from 'playwright';
import { addTimeoutToPromise } from '@apify/timeout';
import { BrowserFingerprintWithHeaders } from 'fingerprint-generator';
import { BrowserPool, PrePageCreateHook } from '../../packages/browser-pool/src/browser-pool';
import { PuppeteerPlugin } from '../../packages/browser-pool/src/puppeteer/puppeteer-plugin';
import { PlaywrightPlugin } from '../../packages/browser-pool/src/playwright/playwright-plugin';
import { BROWSER_POOL_EVENTS } from '../../packages/browser-pool/src/events';
import { BrowserController } from '../../packages/browser-pool/src/abstract-classes/browser-controller';
import { PlaywrightController } from '../../packages/browser-pool/src/playwright/playwright-controller';
import { BrowserName, OperatingSystemsName } from '../../packages/browser-pool/src/fingerprinting/types';
import { PuppeteerController } from '../../packages/browser-pool/src/puppeteer/puppeteer-controller';
import { createProxyServer } from './browser-plugins/create-proxy-server';

const fingerprintingMatrix: [string, PlaywrightPlugin | PuppeteerPlugin][] = [
    [
        'Playwright - persistent',
        new PlaywrightPlugin(
            playwright.chromium,
            {
                useIncognitoPages: false,
            },
        ),
    ],
    [
        'Playwright - Incognito',
        new PlaywrightPlugin(
            playwright.chromium,
            {
                useIncognitoPages: true,
            },
        ),
    ],
    [
        'Puppeteer - Persistent',
        new PuppeteerPlugin(
            puppeteer,
            {
                useIncognitoPages: false,
            },
        ),
    ],
    [
        'Puppeteer - Incognito',
        new PuppeteerPlugin(
            puppeteer,
            {
                useIncognitoPages: true,
            },
        ),
    ],
];
// Tests could be generated from this blueprint for each plugin
describe('BrowserPool', () => {
    const puppeteerPlugin = new PuppeteerPlugin(puppeteer);
    const playwrightPlugin = new PlaywrightPlugin(playwright.chromium); // chromium is faster than firefox and webkit
    let browserPool: BrowserPool<{ browserPlugins: [typeof puppeteerPlugin, typeof playwrightPlugin]; closeInactiveBrowserAfterSecs: 2 }>;

    beforeEach(async () => {
        jest.clearAllMocks();
        browserPool = new BrowserPool({
            browserPlugins: [puppeteerPlugin, playwrightPlugin],
            closeInactiveBrowserAfterSecs: 2,
        });
    });

    afterEach(async () => {
        await browserPool?.destroy();
    });

    let target: http.Server;
    let unprotectedProxy: ProxyChainServer;
    let protectedProxy: ProxyChainServer;

    beforeAll(async () => {
        target = http.createServer((request, response) => {
            response.end(request.socket.remoteAddress);
        });
        await promisify(target.listen.bind(target) as any)(0, '127.0.0.1');

        unprotectedProxy = createProxyServer('127.0.0.2', '', '');
        await unprotectedProxy.listen();

        protectedProxy = createProxyServer('127.0.0.3', 'foo', 'bar');
        await protectedProxy.listen();
    });

    afterAll(async () => {
        await promisify(target.close.bind(target))();

        await unprotectedProxy.close(false);
        await protectedProxy.close(false);
    });

    describe('Initialization & retirement', () => {
        test('should retire browsers', async () => {
            await browserPool.newPage();

            browserPool.retireAllBrowsers();
            expect(browserPool.activeBrowserControllers.size).toBe(0);
            expect(browserPool.retiredBrowserControllers.size).toBe(1);
        });

        test('should destroy pool', async () => {
            const page = await browserPool.newPage();
            const browserController = browserPool.getBrowserControllerByPage(page)!;
            jest.spyOn(browserController, 'close');

            await browserPool.destroy();

            expect(browserController.close).toHaveBeenCalled();
            expect(browserPool.activeBrowserControllers.size).toBe(0);
            expect(browserPool.retiredBrowserControllers.size).toBe(0);
            expect(browserPool['browserKillerInterval']).toBeUndefined();
        });
    });

    describe('Basic user functionality', () => {
        // Basic user facing functionality
        test('should open new page', async () => {
            const page = await browserPool.newPage();

            expect(page.goto).toBeDefined();
            expect(page.close).toBeDefined();
        });

        test('should allow early aborting in case of outer timeout', async () => {
            const timeout = browserPool.operationTimeoutMillis;
            browserPool.operationTimeoutMillis = 500;
            // @ts-expect-error mocking private method
            const spy = jest.spyOn(BrowserPool.prototype, '_executeHooks');

            await browserPool.newPage();
            expect(spy).toBeCalledTimes(4);
            spy.mockReset();

            await expect(addTimeoutToPromise(
                () => browserPool.newPage(),
                10,
                'opening new page timed out',
            )).rejects.toThrowError('opening new page timed out');

            // We terminated early enough so only preLaunchHooks were not executed,
            // thanks to `tryCancel()` calls after each await. If we did not run
            // inside `addTimeoutToPromise()`, this would not work and we would get
            // 4 calls instead of just one.
            expect(spy).toBeCalledTimes(1);

            spy.mockRestore();
            browserPool.operationTimeoutMillis = timeout;
            browserPool.retireAllBrowsers();
        });

        test('proxy sugar syntax', async () => {
            const pool = new BrowserPool({
                browserPlugins: [
                    new PuppeteerPlugin(puppeteer, {
                        useIncognitoPages: true,
                    }),
                    new PlaywrightPlugin(playwright.chromium, {
                        useIncognitoPages: true,
                    }),
                ],
            });

            const options = {
                proxyUrl: `http://foo:bar@127.0.0.3:${protectedProxy.port}`,
                pageOptions: {
                    proxy: {
                        bypass: '<-loopback>',
                    },
                    proxyBypassList: ['<-loopback>'],
                },
            };

            const pages = await pool.newPageWithEachPlugin([
                options,
                options,
            ]);

            for (const page of pages) {
                const response = await page.goto(`http://127.0.0.1:${(target.address() as AddressInfo).port}`);
                const content = await response!.text();

                // Fails on Windows.
                // See https://github.com/puppeteer/puppeteer/issues/7698
                if (process.platform !== 'win32') {
                    expect(content).toBe('127.0.0.3');
                }

                await page.close();
            }

            await pool.destroy();
        });

        test('should open new page in incognito context', async () => {
            const browserPoolIncognito = new BrowserPool({
                browserPlugins: [new PlaywrightPlugin(playwright.chromium, { useIncognitoPages: true })] as const,
                closeInactiveBrowserAfterSecs: 2,
            });

            const page = await browserPoolIncognito.newPage();
            await browserPoolIncognito.newPage();
            await browserPoolIncognito.newPage();

            expect(page.context().pages()).toHaveLength(1);
        });

        test('should open page in correct browser plugin', async () => {
            let page = await browserPool.newPage({
                browserPlugin: playwrightPlugin,
            });

            let controller = browserPool.getBrowserControllerByPage(page)!;
            expect(controller.launchContext.browserPlugin).toBe(playwrightPlugin);

            page = await browserPool.newPage({
                browserPlugin: puppeteerPlugin,
            });

            controller = browserPool.getBrowserControllerByPage(page)!;
            expect(controller.launchContext.browserPlugin).toBe(puppeteerPlugin);
            expect(browserPool.activeBrowserControllers.size).toBe(2);
        });

        test('should loop through plugins round-robin', async () => {
            const correctPluginOrder = [
                puppeteerPlugin,
                playwrightPlugin,
                puppeteerPlugin,
            ];

            const pagePromises = correctPluginOrder.map(() => {
                return browserPool.newPage();
            });
            const pages = await Promise.all(pagePromises);

            expect(pages).toHaveLength(correctPluginOrder.length);
            expect(browserPool.activeBrowserControllers.size).toBe(2);
            pages.forEach((page, idx) => {
                const controller = browserPool.getBrowserControllerByPage(page)!;
                const { browserPlugin } = controller.launchContext;
                const correctPlugin = correctPluginOrder[idx];
                expect(browserPlugin).toBe(correctPlugin);
            });
        });

        test('should open new page in new browser', async () => {
            jest.spyOn(puppeteerPlugin, 'launch');
            jest.spyOn(playwrightPlugin, 'launch');

            await browserPool.newPage();
            await browserPool.newPageInNewBrowser();
            await browserPool.newPageInNewBrowser();

            expect(browserPool.activeBrowserControllers.size).toBe(3);
            expect(puppeteerPlugin.launch).toHaveBeenCalledTimes(2);
            expect(playwrightPlugin.launch).toHaveBeenCalledTimes(1);
        });

        test('newPageWithEachPlugin should open all pages', async () => {
            const [puppeteerPage, playwrightPage] = await browserPool.newPageWithEachPlugin();
            const puppeteerController = browserPool.getBrowserControllerByPage(puppeteerPage)!;
            const playwrightController = browserPool.getBrowserControllerByPage(playwrightPage)!;
            expect(puppeteerController.launchContext.browserPlugin).toBe(puppeteerPlugin);
            expect(playwrightController.launchContext.browserPlugin).toBe(playwrightPlugin);
        });

        test('newPageWithEachPlugin should open in existing browsers', async () => {
            jest.spyOn(puppeteerPlugin, 'launch');
            jest.spyOn(playwrightPlugin, 'launch');

            // launch 2 browsers
            await browserPool.newPage();
            await browserPool.newPage();
            expect(puppeteerPlugin.launch).toHaveBeenCalledTimes(1);
            expect(playwrightPlugin.launch).toHaveBeenCalledTimes(1);
            expect(browserPool.activeBrowserControllers.size).toBe(2);

            // Open more pages
            await browserPool.newPageWithEachPlugin();
            expect(puppeteerPlugin.launch).toHaveBeenCalledTimes(1);
            expect(playwrightPlugin.launch).toHaveBeenCalledTimes(1);
            expect(browserPool.activeBrowserControllers.size).toBe(2);
        });

        test('should correctly override page close', async () => {
            // @ts-expect-error Private function
            jest.spyOn(browserPool!, '_overridePageClose');

            const page = await browserPool.newPage();

            expect(browserPool['_overridePageClose']).toBeCalled();

            const controller = browserPool.getBrowserControllerByPage(page)!;

            expect(controller.activePages).toEqual(1);
            expect(controller.totalPages).toEqual(1);

            await page.close();

            expect(controller.activePages).toEqual(0);
            expect(controller.totalPages).toEqual(1);
        });

        test('should retire browser after page count', async () => {
            browserPool.retireBrowserAfterPageCount = 2;

            jest.spyOn(browserPool, 'retireBrowserController');
            expect(browserPool.activeBrowserControllers.size).toBe(0);

            await browserPool.newPage();
            await browserPool.newPage();
            await browserPool.newPage();

            expect(browserPool.activeBrowserControllers.size).toBe(1);
            expect(browserPool.retiredBrowserControllers.size).toBe(1);

            expect(browserPool.retireBrowserController).toBeCalledTimes(1);
        });

        test('should allow max pages per browser', async () => {
            browserPool.maxOpenPagesPerBrowser = 1;
            // @ts-expect-error Private function
            jest.spyOn(browserPool!, '_launchBrowser');

            await browserPool.newPage();
            expect(browserPool.activeBrowserControllers.size).toBe(1);
            await browserPool.newPage();
            expect(browserPool.activeBrowserControllers.size).toBe(2);
            await browserPool.newPage();
            expect(browserPool.activeBrowserControllers.size).toBe(3);

            expect(browserPool['_launchBrowser']).toBeCalledTimes(3);
        });

        test('should allow max pages per browser - no race condition', async () => {
            browserPool.maxOpenPagesPerBrowser = 1;
            // @ts-expect-error Private function
            jest.spyOn(browserPool, '_launchBrowser');

            const usePuppeteer = {
                browserPlugin: puppeteerPlugin,
            };

            await Promise.all([
                browserPool.newPage(usePuppeteer),
                browserPool.newPage(usePuppeteer),
            ]);

            expect(browserPool.activeBrowserControllers.size).toBe(2);

            expect(browserPool['_launchBrowser']).toBeCalledTimes(2);
        });

        test('should close retired browsers', async () => {
            browserPool.retireBrowserAfterPageCount = 1;

            clearInterval(browserPool['browserKillerInterval']!);

            browserPool['browserKillerInterval'] = setInterval(
                () => browserPool['_closeInactiveRetiredBrowsers'](),
                100,
            );

            // @ts-expect-error Private function
            jest.spyOn(browserPool!, '_closeRetiredBrowserWithNoPages');
            expect(browserPool.retiredBrowserControllers.size).toBe(0);

            const page = await browserPool.newPage();
            const controller = browserPool.getBrowserControllerByPage(page)!;
            jest.spyOn(controller, 'close');

            expect(browserPool.retiredBrowserControllers.size).toBe(1);
            await page.close();

            await new Promise<void>((resolve) => setTimeout(() => {
                resolve();
            }, 1000));

            expect(browserPool['_closeRetiredBrowserWithNoPages']).toHaveBeenCalled();
            expect(controller.close).toHaveBeenCalled();
            expect(browserPool.retiredBrowserControllers.size).toBe(0);
        });

        describe('hooks', () => {
            test('should run hooks in series with custom args', async () => {
                const indexArray: number[] = [];
                const createAsyncHookReturningIndex = (i: number) => async () => {
                    const index = await new Promise<number>((resolve) => setTimeout(() => resolve(i), 100));
                    indexArray.push(index);
                };

                const hooks = new Array(10);
                for (let i = 0; i < hooks.length; i++) {
                    hooks[i] = createAsyncHookReturningIndex(i);
                }

                await browserPool['_executeHooks'](hooks);
                expect(indexArray).toHaveLength(10);
                indexArray.forEach((v, index) => expect(v).toEqual(index));
            });

            describe('preLaunchHooks', () => {
                test('should evaluate hook before launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve();
                    browserPool.preLaunchHooks.push(myAsyncHook);

                    // @ts-expect-error Private function
                    jest.spyOn(browserPool!, '_executeHooks');

                    const page = await browserPool.newPage();
                    const pageId = browserPool.getPageId(page)!;
                    const { launchContext } = browserPool.getBrowserControllerByPage(page)!;
                    expect(browserPool['_executeHooks']).toHaveBeenNthCalledWith(1, browserPool.preLaunchHooks, pageId, launchContext);
                });

                // We had a problem where if the first newPage() call, which launches
                // a browser failed in hooks, then the browserController would get stuck
                // in limbo and subsequent newPage() calls would never resolve.
                test('error in hook does not leave browser stuck in limbo', async () => {
                    const errorMessage = 'pre-launch failed';
                    browserPool.preLaunchHooks = [
                        async () => { throw new Error(errorMessage); },
                    ];

                    const attempts = 5;
                    for (let i = 0; i < attempts; i++) {
                        try {
                            await browserPool.newPage();
                        } catch (err) {
                            expect((err as Error).message).toBe(errorMessage);
                        }
                    }

                    expect(browserPool.activeBrowserControllers.size).toBe(0);
                    expect.assertions(attempts + 1);
                });
            });

            describe('postLaunchHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve();
                    browserPool.postLaunchHooks = [myAsyncHook];

                    // @ts-expect-error Private function
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    const pageId = browserPool.getPageId(page)!;
                    const browserController = browserPool.getBrowserControllerByPage(page)!;

                    expect(browserPool['_executeHooks'])
                        .toHaveBeenNthCalledWith(2, browserPool.postLaunchHooks, pageId, browserController);
                });

                // We had a problem where if the first newPage() call, which launches
                // a browser failed in hooks, then the browserController would get stuck
                // in limbo and subsequent newPage() calls would never resolve.
                test('error in hook does not leave browser stuck in limbo', async () => {
                    const errorMessage = 'post-launch failed';
                    const controllers: BrowserController[] = [];
                    browserPool.postLaunchHooks = [
                        async (_pageId, browserController) => {
                            controllers.push(browserController);
                            throw new Error(errorMessage);
                        },
                    ];

                    const attempts = 5;
                    for (let i = 0; i < attempts; i++) {
                        try {
                            await browserPool.newPage();
                        } catch (err) {
                            expect((err as Error).message).toBe(errorMessage);
                        }
                    }

                    // Wait until all browsers are closed. This will only resolve if all close,
                    // if it does not resolve, the test will timeout and fail.
                    await new Promise<void>((resolve) => {
                        const int = setInterval(() => {
                            const stillWaiting = controllers.some((c) => c.isActive === true);
                            if (!stillWaiting) {
                                clearInterval(int);
                                resolve();
                            }
                        }, 10);
                    });

                    expect(browserPool.activeBrowserControllers.size).toBe(0);
                    expect.assertions(attempts + 1);
                });
            });

            describe('prePageCreateHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve();
                    browserPool.prePageCreateHooks = [myAsyncHook];

                    // @ts-expect-error Private function
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    const pageId = browserPool.getPageId(page)!;
                    const browserController = browserPool.getBrowserControllerByPage(page)!;

                    expect(browserPool['_executeHooks']).toHaveBeenNthCalledWith(
                        3,
                        browserPool.prePageCreateHooks,
                        pageId,
                        browserController,
                        browserController.launchContext.useIncognitoPages ? {} : undefined,
                    );
                });

                test('should allow changing pageOptions', async () => {
                    const hook: PrePageCreateHook<PlaywrightController | PuppeteerController> = (_pageId, _controller, pageOptions) => {
                        if (!pageOptions) {
                            expect(false).toBe(true);
                            return;
                        }

                        const newOptions = {
                            // Puppeteer options
                            proxyServer: `http://127.0.0.3:${protectedProxy.port}`,
                            proxyUsername: 'foo',
                            proxyPassword: 'bar',
                            proxyBypassList: ['<-loopback>'],

                            // Playwright options
                            proxy: {
                                server: `http://127.0.0.3:${protectedProxy.port}`,
                                username: 'foo',
                                password: 'bar',
                                bypass: '<-loopback>',
                            },
                        };

                        Object.assign(pageOptions, newOptions);
                    };

                    const pool = new BrowserPool({
                        browserPlugins: [
                            new PlaywrightPlugin(playwright.chromium, {
                                useIncognitoPages: true,
                                launchOptions: {
                                    args: [
                                        // Exclude loopback interface from proxy bypass list,
                                        // so the request to localhost goes through proxy.
                                        // This way there's no need for a 3rd party server.
                                        '--proxy-bypass-list=<-loopback>',
                                    ],
                                },
                            }),
                            new PuppeteerPlugin(puppeteer, {
                                useIncognitoPages: true,
                            }),
                        ],
                        prePageCreateHooks: [
                            hook,
                        ],
                    });

                    try {
                        const pages = await pool.newPageWithEachPlugin();
                        for (const page of pages) {
                            try {
                                const response = await page.goto(`http://127.0.0.1:${(target.address() as AddressInfo).port}`);
                                const content = await response!.text();

                                // Fails on Windows.
                                // See https://github.com/puppeteer/puppeteer/issues/7698
                                if (process.platform !== 'win32') {
                                    expect(content).toBe('127.0.0.3');
                                }
                            } finally {
                                await page.close();
                            }
                        }
                    } finally {
                        await pool.destroy();
                    }
                });
            });

            describe('postPageCreateHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve();
                    browserPool.postPageCreateHooks = [myAsyncHook];

                    // @ts-expect-error Private function
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    const browserController = browserPool.getBrowserControllerByPage(page);

                    expect(browserPool['_executeHooks']).toHaveBeenNthCalledWith(4, browserPool.postPageCreateHooks, page, browserController);
                });
            });

            describe('prePageCloseHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve();
                    browserPool.prePageCloseHooks = [myAsyncHook];

                    // @ts-expect-error Private function
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    await page.close();

                    const browserController = browserPool.getBrowserControllerByPage(page);
                    expect(browserPool['_executeHooks']).toHaveBeenNthCalledWith(5, browserPool.prePageCloseHooks, page, browserController);
                });
            });

            describe('postPageCloseHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve();
                    browserPool.postPageCloseHooks = [myAsyncHook];

                    // @ts-expect-error Private function
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    const pageId = browserPool.getPageId(page);
                    await page.close();

                    const browserController = browserPool.getBrowserControllerByPage(page);
                    expect(browserPool['_executeHooks']).toHaveBeenNthCalledWith(6, browserPool.postPageCloseHooks, pageId, browserController);
                });
            });

            describe('default browser automation masking', () => {
                describe.each(fingerprintingMatrix)('%s', (_name, plugin) => {
                    let browserPoolWithDefaults: BrowserPool;
                    let page: any;

                    beforeEach(async () => {
                        browserPoolWithDefaults = new BrowserPool({
                            browserPlugins: [plugin],
                            closeInactiveBrowserAfterSecs: 2,
                        });
                        page = await browserPoolWithDefaults.newPage();
                    });

                    afterEach(async () => {
                        if (page) await page.close();

                        await browserPoolWithDefaults.destroy();
                    });

                    test('should hide webdriver', async () => {
                        await page.goto(`file://${__dirname}/test.html`);
                        const webdriver = await page.evaluate(() => {
                            return navigator.webdriver;
                        });
                        // Can be undefined or false, depending on the chrome version.
                        expect(webdriver).toBeFalsy();
                    });
                });
            });

            describe('fingerprinting', () => {
                describe.each(fingerprintingMatrix)('%s', (_name, plugin) => {
                    let browserPoolWithFP: BrowserPool;
                    let page: any;

                    beforeEach(async () => {
                        browserPoolWithFP = new BrowserPool({
                            browserPlugins: [plugin],
                            closeInactiveBrowserAfterSecs: 2,
                            useFingerprints: true,
                        });
                        page = await browserPoolWithFP.newPage();
                    });

                    afterEach(async () => {
                        if (page) await page.close();

                        await browserPoolWithFP.destroy();
                    });

                    test('should override fingerprint', async () => {
                        await page.goto(`file://${__dirname}/test.html`);
                        // @ts-expect-error mistypings
                        const browserController = browserPoolWithFP.getBrowserControllerByPage(page);

                        const data: { hardwareConcurrency: number; userAgent: string } = await page.evaluate(() => {
                            return {
                                hardwareConcurrency: navigator.hardwareConcurrency,
                                userAgent: navigator.userAgent,
                            };
                        });
                        // @ts-expect-error mistypings
                        const { fingerprint } = browserController!.launchContext!.fingerprint as BrowserFingerprintWithHeaders;

                        expect(data.hardwareConcurrency).toBe(fingerprint?.navigator.hardwareConcurrency);
                        expect(data.userAgent).toBe(fingerprint?.navigator.userAgent);
                    });

                    test('should hide webdriver', async () => {
                        await page.goto(`file://${__dirname}/test.html`);
                        const webdriver = await page.evaluate(() => {
                            return navigator.webdriver;
                        });
                        // Can be undefined or false, depending on the chrome version.
                        expect(webdriver).toBeFalsy();
                    });
                });

                describe('caching', () => {
                    const commonOptions = {
                        browserPlugins: [new PlaywrightPlugin(
                            playwright.chromium,
                            {
                                useIncognitoPages: true,
                            },
                        )],
                    };
                    let browserPoolCache: BrowserPool;

                    afterEach(async () => {
                        await browserPoolCache.destroy();
                    });
                    test('should use fingerprint per proxy by default', async () => {
                        browserPoolCache = new BrowserPool({
                            ...commonOptions,
                            useFingerprints: true,
                        });

                        expect(browserPoolCache.fingerprintCache).toBeDefined();
                    });

                    test('should turn off cache', async () => {
                        browserPoolCache = new BrowserPool({
                            ...commonOptions,
                            useFingerprints: true,
                            fingerprintsOptions: {
                                useFingerprintPerProxyCache: false,
                            },
                        });

                        expect(browserPoolCache.fingerprintCache).toBeUndefined();
                    });

                    test('should limit cache size', async () => {
                        browserPoolCache = new BrowserPool({
                            ...commonOptions,
                            useFingerprints: true,
                            fingerprintsOptions: {
                                fingerprintPerProxyCacheSize: 1,
                            },
                        });
                        // cast to any type in order to acces the maxSize property for testing purposes.
                        const cache: any = browserPoolCache!.fingerprintCache!;
                        expect(cache.maxSize).toBe(1);
                    });

                    test('should cache fingerprints', async () => {
                        browserPoolCache = new BrowserPool({
                            ...commonOptions,
                            useFingerprints: true,
                            preLaunchHooks: [
                                (_pageId, launchContext) => {
                                    // @ts-expect-error issue caused by generics
                                    launchContext.extend({ proxyUrl: 'http://localhost:8080' });
                                },
                            ],
                        });
                        const mock = jest.fn();
                        browserPoolCache.fingerprintInjector!.attachFingerprintToPlaywright = mock;
                        const page: Page = await browserPoolCache.newPageInNewBrowser();
                        expect(mock.mock.calls[0][1]).toBeDefined();
                        const page2: Page = await browserPoolCache.newPageInNewBrowser();
                        await page.close();
                        await page2.close();
                        // expect fingerprint parameter of the first call to equal fingerprint parameter of the second call
                        expect(mock.mock.calls[0][1]).toBe(mock.mock.calls[1][1]);
                    });
                });
            });
            describe('generator configuration', () => {
                const commonOptions = {
                    browserPlugins: [new PlaywrightPlugin(
                        playwright.firefox,
                        {
                            useIncognitoPages: true,
                        },
                    )],
                };
                let browserPoolConfig: BrowserPool;
                afterEach(async () => {
                    await browserPoolConfig.destroy();
                });
                test('should use native os and browser', async () => {
                    browserPoolConfig = new BrowserPool({
                        ...commonOptions,
                        useFingerprints: true,
                    });
                    const oldGet = browserPoolConfig.fingerprintGenerator.getFingerprint;
                    const mock = jest.fn((options) => {
                        return oldGet.bind(browserPoolConfig.fingerprintGenerator)(options);
                    });
                    browserPoolConfig.fingerprintGenerator.getFingerprint = mock;

                    const page: Page = await browserPoolConfig.newPage();
                    await page.close();
                    const defaultOptions = mock.mock.calls[0][0];

                    expect(defaultOptions.browsers.includes('firefox')).toBe(true);

                    let os: string;
                    switch (process.platform) {
                        case 'darwin':
                            os = 'macos';
                            break;
                        case 'win32':
                            os = 'windows';
                            break;
                        default:
                            os = 'linux';
                    }
                    expect(defaultOptions.operatingSystems.includes(os)).toBe(true);
                });

                test('should allow changing options', async () => {
                    browserPoolConfig = new BrowserPool({
                        ...commonOptions,
                        useFingerprints: true,
                        fingerprintsOptions: {
                            fingerprintGeneratorOptions: {
                                operatingSystems: [OperatingSystemsName.windows],
                                browsers: [BrowserName.chrome],
                            },
                        },
                    });
                    const oldGet = browserPoolConfig.fingerprintGenerator.getFingerprint;
                    const mock = jest.fn((options) => {
                        return oldGet.bind(browserPoolConfig.fingerprintGenerator)(options);
                    });
                    browserPoolConfig.fingerprintGenerator.getFingerprint = mock;
                    const page: Page = await browserPoolConfig.newPageInNewBrowser();
                    await page.close();
                    const [options] = mock.mock.calls[0];
                    expect(options.operatingSystems.includes('windows')).toBe(true);
                    expect(options.browsers.includes('chrome')).toBe(true);
                });
            });
        });

        describe('events', () => {
            test(`should emit ${BROWSER_POOL_EVENTS.BROWSER_LAUNCHED} event`, async () => {
                browserPool.maxOpenPagesPerBrowser = 1;
                let calls = 0;
                let argument;

                browserPool.on(BROWSER_POOL_EVENTS.BROWSER_LAUNCHED, (arg) => {
                    argument = arg;
                    calls++;
                });
                await browserPool.newPage();
                const page = await browserPool.newPage();

                expect(calls).toEqual(2);
                expect(argument).toEqual(browserPool.getBrowserControllerByPage(page));
            });

            test(`should emit ${BROWSER_POOL_EVENTS.BROWSER_RETIRED} event`, async () => {
                browserPool.retireBrowserAfterPageCount = 1;
                let calls = 0;
                let argument;
                browserPool.on(BROWSER_POOL_EVENTS.BROWSER_RETIRED, (arg) => {
                    argument = arg;
                    calls++;
                });

                await browserPool.newPage();
                const page = await browserPool.newPage();

                expect(calls).toEqual(2);
                expect(argument).toEqual(browserPool.getBrowserControllerByPage(page));
            });

            test(`should emit ${BROWSER_POOL_EVENTS.PAGE_CREATED} event`, async () => {
                let calls = 0;
                let argument;
                browserPool.on(BROWSER_POOL_EVENTS.PAGE_CREATED, (arg) => {
                    argument = arg;
                    calls++;
                });

                const page = await browserPool.newPage();
                expect(argument).toEqual(page);
                const page2 = await browserPool.newPage();
                expect(calls).toEqual(2);
                expect(argument).toEqual(page2);
            });

            test(`should emit ${BROWSER_POOL_EVENTS.PAGE_CLOSED} event`, async () => {
                let calls = 0;
                let argument;
                browserPool.on(BROWSER_POOL_EVENTS.PAGE_CLOSED, (arg) => {
                    argument = arg;
                    calls++;
                });

                const page = await browserPool.newPage();
                await page.close();
                expect(argument).toEqual(page);
                const page2 = await browserPool.newPage();
                await page2.close();
                expect(calls).toEqual(2);
                expect(argument).toEqual(page2);
            });
        });
    });
});
