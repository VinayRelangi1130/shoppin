const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const { URL } = require('url');
const app = express();

app.use(express.json());

const extractProductUrls = async (domain) => {
    let productUrls;

    try {
        productUrls = new Set();
        const response = await axios.get(domain, {
            timeout: 5000 
        });
        const $ = cheerio.load(response.data);

        $('a').each((_, element) => {
            const href = $(element).attr('href');
            if (href && (href.includes('/product') || href.includes('/item') || href.includes('/p'))) {
                const fullUrl = new URL(href, domain).href;
                productUrls.add(fullUrl);
            }
        });
    } catch (error) {
        console.error(`Error fetching data from ${domain}:`, error.message);
        try {
            console.log(`Retrying ${domain}...`);
            const response = await axios.get(domain, {
                timeout: 5000
            });
            const $ = cheerio.load(response.data);

            $('a').each((_, element) => {
                const href = $(element).attr('href');
                if (href && (href.includes('/product') || href.includes('/item') || href.includes('/p'))) {
                    const fullUrl = new URL(href, domain).href;
                    productUrls.add(fullUrl);
                }
            });
        } catch (retryError) {
            console.error(`Retry failed for ${domain}:`, retryError.message);
        }
    }

    return Array.from(productUrls || []);
};

const handleInfiniteScroll = async (domain) => {
    try {
        const productUrls = new Set();
        let page = 1;
        let hasMoreContent = true;

        while (hasMoreContent) {
            console.log(`Fetching page ${page} for ${domain}`);
            const response = await axios.get(`${domain}?page=${page}`, {
                timeout: 5000
            });
            const $ = cheerio.load(response.data);

            const currentUrls = [];
            $('a').each((_, element) => {
                const href = $(element).attr('href');
                if (href && (href.includes('/product') || href.includes('/item') || href.includes('/p'))) {
                    const fullUrl = new URL(href, domain).href;
                    currentUrls.push(fullUrl);
                    productUrls.add(fullUrl);
                }
            });

            if (currentUrls.length === 0) {
                hasMoreContent = false;
            }
            page++;
        }

        return Array.from(productUrls);
    } catch (error) {
        console.error(`Error handling infinite scroll for ${domains}:`, error.message);
        return [];
    }
};


const crawlDomains = async (domains) => {
    const results = {};

    for (const domain of domains) {
        console.log(`Crawling domain: ${domain}`);
        const productUrls = await extractProductUrls(domain);
        const additionalUrls = await handleInfiniteScroll(domain);
        results[domain] = [...new Set([...productUrls, ...additionalUrls])];
    }


    await fs.writeFile('product_urls.json', JSON.stringify(results, null, 2));
    console.log('Crawling complete. Results saved to product_urls.json');
};


app.post('/start-crawl', async (req, res) => {
    const { domains } = req.body;

    if (!Array.isArray(domains) || domains.length === 0) {
        return res.status(400).send('Invalid input. Please provide an array of domain URLs.');
    }

    try {
        await crawlDomains(domains);
        res.send('Crawling complete. Check the product_urls.json file for results.');
    } catch (error) {
        res.status(500).send('Error during crawling: ' + error.message);
    }
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${3000}`);
});
