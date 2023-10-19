const puppeteer = require('puppeteer');
const fs = require('fs');

const scrollsMax = 100;
const targetUrl = 'https://twitter.com/NischalShetty';

class Tweet {
  timeStamp;
  tweetContent;
  constructor(timeStamp, tweetContent) {
    this.timeStamp = timeStamp;
    this.tweetContent = tweetContent;
  }
}

class Tweets {
  timeStamps = [];
  tweets = [];
  
  addTweet(tweet) {
    if(this.timeStamps.indexOf(tweet.timeStamp) < 0) {
      this.timeStamps.push(tweet.timeStamp);
      this.tweets.push(tweet)
    }
  }
  
  getTweets() {
    return this.tweets
  }

  getTweetsAmount() {
    return this.tweets.length
  }
}

async function wait(milliseconds) {
  return new Promise(r => setTimeout(r, milliseconds))
}

const parsedTweets = new Tweets();

async function scrollAndParse(page, lastTweetTime = null, scrolls = 1, scrollHeight = 0) {
  console.log(`Scroll number: ${scrolls}`);
  // await page.waitForNetworkIdle({idleTime: 1000, timeout: 60000});
  await wait(500);
  
  console.log('Get tweets');
  let tweets;
  try {
    tweets = await page.$x(`//article[@data-testid="tweet"]`);
  } catch (error) {
    console.log("Error occured, dom was changed");
    return scrollAndParse(page, lastTweetTime, scrolls, scrollHeight);
  }
  
  
  console.log(`Found ${tweets.length} tweets`);
  let timeStampElement  = await tweets[tweets.length - 1].$('xpath/' + `.//time`);  
  const currentLastTweetTime = await page.evaluate(el => el.getAttribute('datetime'), timeStampElement);
  
  // console.log(`Current last tweet time is: ${currentLastTweetTime}`);   

  try {
    for(let tweet of tweets) {
      let timeStampElement  = await tweet.$('xpath/' + `.//time`);
      let timeStamp = await page.evaluate(el => el.getAttribute('datetime'), timeStampElement);       
      let tweetContent = await page.evaluate(el => el.outerHTML, tweet);
      parsedTweets.addTweet(new Tweet(timeStamp, tweetContent));      
    }
  } catch (error) {
    console.log("Error occured, dom was changed");
    return scrollAndParse(page, lastTweetTime, scrolls, scrollHeight);
  }
  

  console.log(`Parsed: ${parsedTweets.getTweetsAmount()} tweets`);  

  if(scrolls === 1 ) {
    scrollHeight += 1000;
    await page.evaluate(`window.scrollTo(0, ${scrollHeight})`);
    return scrollAndParse(page, lastTweetTime = currentLastTweetTime, scrolls + 1, scrollHeight + 1000);
  } else if(scrolls < scrollsMax && currentLastTweetTime !== lastTweetTime) {
    await page.evaluate(`window.scrollTo(0, ${scrollHeight})`);
    return scrollAndParse(page, lastTweetTime = currentLastTweetTime, scrolls + 1, scrollHeight + 1000);
  } else {
    fs.writeFileSync('content.json', JSON.stringify(parsedTweets.getTweets()));
    console.log("Parsing finished");
  }
}



async function main(url) {
  const browser = await puppeteer.launch({
    headless: "new"
    // headless: false
  });
  
  try {
    
    const page = await browser.newPage();
  
    await page.setViewport({width: 1080, height: 1024});
    console.log(`Go to URL: ${url}`)
    console.log(`Wait for window load`)
    await page.goto(url, { timeout: 60000 });    
    await page.waitForNetworkIdle({ idleTime: 1000 })
  
    console.log('Start parsing')
    await scrollAndParse(page);
    
    console.log('Closing browser');
    await browser.close();
  } catch (error) {
    await browser.close();
    fs.writeFileSync('error.txt', JSON.stringify({error: error.name, errMessage: error.message, cause: error.cause}));
    console.log('');
    console.log("Error occured, retry");
    console.log('');
    await main(url);
  }
  
}

(async () => {  
  console.time('parsing');
  await main(targetUrl);  
  console.timeEnd('parsing');
})();