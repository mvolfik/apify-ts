import { Actor } from 'apify';
import { CheerioCrawler } from '@crawlee/cheerio';
import { ApifyStorageLocal } from '@apify/storage-local';

const mainOptions = {
    exit: Actor.isAtHome(),
    storage: process.env.STORAGE_IMPLEMENTATION === 'LOCAL' ? new ApifyStorageLocal() : undefined,
};

await Actor.main(async () => {
    const crawler = new CheerioCrawler({
        async requestHandler({ request, $, enqueueLinks }) {
            const { userData: { label } } = request;

            if (label === 'START') {
                await enqueueLinks({
                    globs: [{ glob: 'https://apify.com/apify/web-scraper', userData: { label: 'DETAIL' } }],
                });
            }

            if (label === 'DETAIL') {
                const { url } = request;

                const uniqueIdentifier = url.split('/').slice(-2).join('/');
                const title = $('header h1').text();
                const description = $('header span.actor-description').text();
                const modifiedDate = $('ul.ActorHeader-stats time').attr('datetime');
                const runCount = $('ul.ActorHeader-stats > li:nth-of-type(3)').text().match(/[\d,]+/)[0].replace(/,/g, '');

                await Actor.pushData({
                    url,
                    uniqueIdentifier,
                    title,
                    description,
                    modifiedDate: new Date(Number(modifiedDate)),
                    runCount: Number(runCount),
                });
            }
        },
    });

    await crawler.addRequests([{ url: 'https://apify.com/apify', userData: { label: 'START' } }]);
    await crawler.run();
}, mainOptions);
