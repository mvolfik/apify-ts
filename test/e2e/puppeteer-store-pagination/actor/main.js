import { Actor } from 'apify';
import { PuppeteerCrawler } from '@crawlee/puppeteer';
import { ApifyStorageLocal } from '@apify/storage-local';

const mainOptions = {
    exit: Actor.isAtHome(),
    storage: process.env.STORAGE_IMPLEMENTATION === 'LOCAL' ? new ApifyStorageLocal() : undefined,
};

await Actor.main(async () => {
    const crawler = new PuppeteerCrawler({
        maxRequestsPerCrawl: 10,
        preNavigationHooks: [({ session, request }, goToOptions) => {
            session?.setPuppeteerCookies([{ name: 'OptanonAlertBoxClosed', value: new Date().toISOString() }], request.url);
            goToOptions.waitUntil = ['networkidle2'];
        }],
        async requestHandler({ page, enqueueLinks, request, log }) {
            const { url, userData: { label } } = request;

            if (label === 'START') {
                log.info('Store opened');
                const nextButtonSelector = '[data-test="pagination-button-next"]:not([disabled])';
                // enqueue actor details from the first three pages of the store
                for (let pageNo = 1; pageNo <= 3; pageNo++) {
                    // Wait for network events to finish
                    await page.waitForNetworkIdle();
                    // Enqueue all loaded links
                    await enqueueLinks({
                        selector: 'a.ActorStoreItem',
                        globs: [{ glob: 'https://apify.com/*/*', userData: { label: 'DETAIL' } }],
                    });
                    log.info(`Enqueued actors for page ${pageNo}`);
                    log.info('Loading the next page');
                    await page.evaluate((el) => document.querySelector(el)?.click(), nextButtonSelector);
                }
            } else if (label === 'DETAIL') {
                log.info(`Scraping ${url}`);

                const uniqueIdentifier = url.split('/').slice(-2).join('/');
                const titleP = page.$eval('header h1', ((el) => el.textContent));
                const descriptionP = page.$eval('header span.actor-description', ((el) => el.textContent));
                const modifiedTimestampP = page.$eval('ul.ActorHeader-stats time', (el) => el.getAttribute('datetime'));
                const runCountTextP = page.$eval('ul.ActorHeader-stats li:nth-of-type(3)', ((el) => el.textContent));
                const [
                    title,
                    description,
                    modifiedTimestamp,
                    runCountText,
                ] = await Promise.all([
                    titleP,
                    descriptionP,
                    modifiedTimestampP,
                    runCountTextP,
                ]);
                const modifiedDate = new Date(Number(modifiedTimestamp));
                const runCount = Number(runCountText.match(/[\d,]+/)[0].replace(/,/g, ''));

                await Actor.pushData({ url, uniqueIdentifier, title, description, modifiedDate, runCount });
            }
        },
    });

    await crawler.addRequests([{ url: 'https://apify.com/store?page=1', userData: { label: 'START' } }]);
    await crawler.run();
}, mainOptions);
