const puppeteer = require('puppeteer')
const fs = require('fs')
const {writeFile} = require('fs').promises
const path = require('path')

let retry = 0
let maxRetries = 5

let userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4298.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
]

;(async function scrape() {
    retry++

    let jobs = []
    let userAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

    const browser = await puppeteer.launch()

    try {
        const page = await browser.newPage()
        await page.setUserAgent(userAgent)
        console.log('Going to the Target...')
        await page.goto('https://vulearning.com/')
        console.log('Scraping...')

        const getLatestJobsLinks = await page.evaluate(() => {
            const hrefs = []
            const titles = []
            let latestJobs = Array.from(
                document.querySelectorAll('.news_top_jobs_link a')
            )
            latestJobs.forEach(job => {
                hrefs.push(job.getAttribute('href'))
                titles.push(job.textContent.trim())
            })
            return {titles, hrefs}
        })
        const {hrefs, titles} = getLatestJobsLinks
        console.log(
            `\n\n---------- TOTAL JOBS TO SCRAP: ${hrefs.length} ----------\n\n`
        )
        // Go to the Jobs Links and get Ads Images Links
        console.log('Getting Jobs Ads Links')

        const adsLinks = []
        for (let job = 0; job < hrefs.length; job++) {
            try {
                console.log(`\nGoing to Job No ${job + 1} page...`)
                await page.goto(hrefs[job])
                console.log(`Scraping Job No ${job + 1} page...\n`)
                let adLink = await page.$eval('#dimg', el => {
                    return window
                        .getComputedStyle(el)
                        .getPropertyValue('background-image')
                        .split(`"`)[1]
                })
                console.log(`Ad Link: ${adLink}\n`)
                adsLinks.push(adLink)
            } catch (err) {
                job--
                continue
            }
        }

        console.log(`\n\n Going to Ads Links to get Ads Images:\n`)

        console.log('Ads Links', adsLinks)
        let date = new Date().toDateString()
        console.log('Date:', date)
        if (!fs.existsSync(path.join(`./vujobs`))) {
            fs.mkdirSync(path.join(`./vujobs`))
        }
        let vujobsPath = path.join(`./vujobs/${date}`)
        if (!fs.existsSync(vujobsPath)) {
            fs.mkdirSync(vujobsPath)
        }
        for (let i = 0; i < adsLinks.length; i++) {
            console.log(`Going to Ad ${i + 1}: ${adsLinks[i]}\n`)
            try {
                let adPage = await page.goto(adsLinks[i])
                let title = titles[i].split('/').join('_')
                await writeFile(
                    `${vujobsPath}/${title} - ${path.basename(adsLinks[i])}`,
                    await adPage.buffer()
                )
            } catch (err) {
                console.log('Error', err)
                i--
            }
        }

        console.log('\n\nScraping Completed!\n\n')

        await browser.close()
    } catch (e) {
        console.log('Error', e)
        await browser.close()

        if (retry < maxRetries) {
            scrape()
        }
    }
})()
