const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is missing");
}

if (!TWELVE_DATA_API_KEY) {
  throw new Error("TWELVE_DATA_API_KEY environment variable is missing");
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const TIMEFRAMES = {
  M1: "1min",
  M5: "5min",
  M15: "15min",
  H1: "1h",
};

async function getCandles(interval, outputsize = 100) {
  const url = new URL("https://api.twelvedata.com/time_series");

  url.searchParams.set("symbol", "XAU/USD");
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", TWELVE_DATA_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.status === "error" || !data.values) {
    throw new Error(data.message || "Failed to retrieve gold candles");
  }

  return data.values.map((candle) => ({
    time: candle.datetime,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  }));
}

function getTrend(candles) {
  if (candles.length < 6) {
    return "داده کافی برای بررسی روند وجود ندارد.";
  }

  const recent = candles.slice(0, 6);
  const firstClose = recent[recent.length - 1].close;
  const lastClose = recent[0].close;

  if (lastClose > firstClose) {
    return "قیمت در کندل‌های اخیر افزایش داشته است.";
  }

  if (lastClose < firstClose) {
    return "قیمت در کندل‌های اخیر کاهش داشته است.";
  }

  return "قیمت در کندل‌های اخیر تقریباً ثابت بوده است.";
}

bot.onText(/^\/start$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "سلام! 👋\nبه ربات تحلیل تکنیکال طلا خوش آمدی.\n\n" +
      "/gold - قیمت و اطلاعات طلا\n" +
      "/m1 - تحلیل اولیه یک‌دقیقه‌ای\n" +
      "/m5 - تحلیل اولیه پنج‌دقیقه‌ای\n" +
      "/m15 - تحلیل اولیه پانزده‌دقیقه‌ای\n" +
      "/h1 - تحلیل اولیه یک‌ساعته\n" +
      "/help - راهنما"
  );
});

bot.onText(/^\/ping$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, "ربات فعال است ✅");
});

bot.onText(/^\/help$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "دستورهای ربات:\n" +
      "/gold - قیمت طلا\n" +
      "/m1 - کندل‌های M1\n" +
      "/m5 - کندل‌های M5\n" +
      "/m15 - کندل‌های M15\n" +
      "/h1 - کندل‌های H1\n" +
      "/ping - بررسی فعال بودن ربات"
  );
});

bot.onText(/^\/gold$/, async (msg) => {
  try {
    const candles = await getCandles("1min", 1);
    const price = candles[0].close;
    const gramPrice = price / 31.1034768;

    await bot.sendMessage(
      msg.chat.id,
      "🟡 قیمت جهانی طلا (XAU/USD)\n\n" +
        `💵 هر اونس: ${price.toFixed(2)} دلار\n` +
        `⚖️ هر گرم: ${gramPrice.toFixed(2)} دلار\n` +
        `🕒 زمان کندل: ${candles[0].time}\n\n` +
        "توجه: این قیمت مربوط به منبع داده Twelve Data است."
    );
  } catch (error) {
    console.error("Gold command error:", error.message);
    await bot.sendMessage(
      msg.chat.id,
      "دریافت قیمت طلا ناموفق بود. لطفاً بعداً دوباره تلاش کن."
    );
  }
});

for (const [command, interval] of Object.entries(TIMEFRAMES)) {
  bot.onText(new RegExp(`^/${command.toLowerCase()}$`), async (msg) => {
    try {
      const candles = await getCandles(interval, 100);
      const latest = candles[0];

      await bot.sendMessage(
        msg.chat.id,
        `🟡 تحلیل اولیه طلا — ${command}\n\n` +
          `🕒 زمان کندل: ${latest.time}\n` +
          `🔓 باز شدن: ${latest.open}\n` +
          `🔺 بیشترین: ${latest.high}\n` +
          `🔻 کمترین: ${latest.low}\n` +
          `🔒 بسته شدن: ${latest.close}\n\n` +
          `📊 ${getTrend(candles)}\n\n` +
          "این نسخه اولیه است و هنوز BOS، CHoCH و نقدینگی را تشخیص نمی‌دهد."
      );
    } catch (error) {
      console.error(`${command} error:`, error.message);
      await bot.sendMessage(
        msg.chat.id,
        "دریافت کندل‌ها ناموفق بود. ممکن است محدودیت API یا خطای اتصال وجود داشته باشد."
      );
    }
  });
}

console.log("Gold analysis bot started.");
