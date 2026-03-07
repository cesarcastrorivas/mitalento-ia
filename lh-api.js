const https = require('https');
const url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://urbanityacademy.com&category=performance&category=accessibility&category=best-practices&category=seo&strategy=mobile';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("API Error:", json.error.message);
                return;
            }
            const categories = json.lighthouseResult.categories;
            const scores = {
                strategy: 'MOBILE',
                performance: categories.performance?.score * 100,
                accessibility: categories.accessibility?.score * 100,
                bestPractices: categories['best-practices']?.score * 100,
                seo: categories.seo?.score * 100
            };
            console.log('SCORES:', JSON.stringify(scores, null, 2));

            const audits = json.lighthouseResult.audits;
            const metrics = {
                FCP: audits['first-contentful-paint']?.displayValue,
                LCP: audits['largest-contentful-paint']?.displayValue,
                TBT: audits['total-blocking-time']?.displayValue,
                CLS: audits['cumulative-layout-shift']?.displayValue,
                TTI: audits['interactive']?.displayValue,
                SpeedIndex: audits['speed-index']?.displayValue
            };
            console.log('METRICS:', JSON.stringify(metrics, null, 2));
        } catch (e) {
            console.error("Parse Error:", e);
        }
    });
}).on('error', (err) => {
    console.error("Request Error:", err);
});
