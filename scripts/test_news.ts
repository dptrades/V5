
import { getNewsData } from '../lib/news-service';

async function test() {
    console.log("Fetching news for AAPL...");
    const news = await getNewsData('AAPL', 'news');
    console.log("News Items:", news.length);
    if (news.length > 0) {
        console.log("First Item:", news[0]);
    } else {
        console.log("No news found.");
    }

    console.log("\nFetching analyst ratings for AAPL...");
    const analyst = await getNewsData('AAPL', 'analyst');
    console.log("Analyst Items:", analyst.length);
    if (analyst.length > 0) {
        console.log("First Item:", analyst[0]);
    } else {
        console.log("No analyst ratings found.");
    }
}

test();
