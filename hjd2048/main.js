const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");

const CONFIG = {
  BASE_URL: "https://v8.9rnri.com/2048/",
  ACCOUNT: process.env.HJD_ACCOUNT || "",
  PASSWORD: process.env.HJD_PASSWORD || "",
  QUESTION: process.env.HJD_QUESTION || "",
  ANSWER: process.env.HJD_ANSWER || "",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readFileToBase64(name) {
  return fs.readFileSync(name).toString("base64");
}

async function getVerifyPosition(bgBase64, slideBase64) {
  const bg = bgBase64.replace(/^data:image\/\w+;base64,/, "");
  const slide = slideBase64.replace(/^data:image\/\w+;base64,/, "");
  const res = await axios.post("http://127.0.0.1:9991/slideMatch", {
    slider: slide,
    background: bg,
  });
  return res.data.distance;
}

async function getBase64FromUrl(url, browser) {
  const page = await browser.newPage();
  await page.goto(url);
  let data = await page.evaluate(() => {
    const img = document.querySelector("img");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  });
  await page.close();
  return data;
}

async function doSlide(browser, page) {
  const iframe = page.frames().find((f) => f.url().includes("cap_union_new_show.php"));
  await sleep(4000);
  if (!iframe) return;

  const start = await iframe.$("#tcaptcha_drag_thumb");
  if (!start) return;

  const bgElement = await iframe.$(".tc-bg-img");
  const slideElement = await iframe.$(".tc-jpp-img");
  if (!bgElement) return;

  const bgSrc = await bgElement.evaluate((img) => img.src);
  const slideSrc = await slideElement.evaluate((img) => img.src);
  const bgBase64 = await getBase64FromUrl(bgSrc, browser);
  const slideBase64 = await getBase64FromUrl(slideSrc, browser);

  let distance = await getVerifyPosition(bgBase64, slideBase64);
  distance = distance / 2;
  console.log("滑块距离:", distance);

  const startInfo = await start.boundingBox();
  let startX = startInfo.x + 10;
  let startY = startInfo.y + 10;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 0; i < distance; i += Math.floor(Math.random() * 11)) {
    await sleep(Math.floor(Math.random() * 100));
    await page.mouse.move(startX + i, startY);
  }
  await sleep(500);
  await page.mouse.up();
  await sleep(2000);
}

async function main() {
  if (!CONFIG.ACCOUNT || !CONFIG.PASSWORD) {
    console.error("❌ 未配置账号密码，请设置 HJD_ACCOUNT 和 HJD_PASSWORD");
    process.exit(1);
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: { width: 1440, height: 1000 },
      ignoreHTTPSErrors: false,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--no-sandbox",
        "--lang=zh-CN",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1440,1000",
      ],
    });

    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      const newProto = navigator.__proto__;
      delete newProto.webdriver;
      navigator.__proto__ = newProto;
    });

    console.log("正在访问登录页面...");
    for (let i = 0; i < 4; i++) {
      await page.goto(CONFIG.BASE_URL + "login.php");
    }

    await page.waitForSelector("input[name='pwuser']");
    await page.type("input[name='pwuser']", CONFIG.ACCOUNT);
    await page.type("input[name='pwpwd']", CONFIG.PASSWORD);

    if (CONFIG.QUESTION) {
      await page.select("select[name='question']", CONFIG.QUESTION);
    }
    if (CONFIG.ANSWER) {
      await page.type("input[name='answer']", CONFIG.ANSWER);
    }

    await (await page.$(".btn")).click();
    await sleep(5000);
    console.log("登录完成，跳转签到页...");

    await page.goto(CONFIG.BASE_URL + "hack.php?H_name=qiandao");
    await page.waitForSelector("input[name='qdxq']");
    await (await page.$("input[name='qdxq']")).click();
    await (await page.$("#hy_code")).click();

    await page.waitForSelector("#tcaptcha_iframe");

    for (let i = 0; i < 4; i++) {
      await doSlide(browser, page);
    }
    await sleep(4000);

    const screenshotName = "hjd2048_result.png";
    await page.screenshot({ path: screenshotName });
    console.log("✅ 签到完成！截图已保存：" + screenshotName);
    console.log(
      "data:image/png;base64," + (await readFileToBase64(screenshotName))
    );
  } catch (e) {
    console.error("❌ 签到失败:", e.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
