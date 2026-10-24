const API_BASE = "https://api.telegram.org";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Himan Gold AI Bot is running!");
    }

    if (url.pathname !== "/webhook" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    let update;

    try {
      update = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const message = update.message;

    if (!message?.text || !message.chat?.id) {
      return new Response("OK");
    }

    const chatId = message.chat.id;
    const command = message.text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();

    const commands = {
      "/gold": ["5min", "M5"],
      "/m1": ["1min", "M1"],
      "/m5": ["5min", "M5"],
      "/m15": ["15min", "M15"],
      "/h1": ["1h", "H1"]
    };

    let reply;

    if (command === "/start") {
      reply =
        "سلام! به ربات تحلیل طلای هیمن خوش آمدی. 🥇\n\n" +
        "دستورها:\n" +
        "/gold - تحلیل کلی طلا\n" +
        "/m1 - تحلیل یک دقیقه\n" +
        "/m5 - تحلیل پنج دقیقه\n" +
        "/m15 - تحلیل پانزده دقیقه\n" +
        "/h1 - تحلیل یک ساعته\n" +
        "/help - راهنما";
    } else if (command === "/help") {
      reply =
        "📊 دستورهای تحلیل طلا:\n" +
        "/gold - تحلیل M5\n" +
        "/m1 - تحلیل M1\n" +
        "/m5 - تحلیل M5\n" +
        "/m15 - تحلیل M15\n" +
        "/h1 - تحلیل H1";
    } else if (commands[command]) {
      try {
        reply = await analyzeGold(env, ...commands[command]);
      } catch (error) {
        console.error("Analysis error:", error);
        reply = "❌ دریافت یا تحلیل اطلاعات طلا ناموفق بود. کمی بعد دوباره تلاش کن.";
      }
    } else {
      reply = "فرمان شناخته نشد. برای راهنما /help را بفرست.";
    }

    try {
      await sendTelegram(env.BOT_TOKEN, chatId, reply);
    } catch (error) {
      console.error("Send message error:", error);
    }

    return new Response("OK");
  }
};

async function analyzeGold(env, interval, label) {
  if (!env.TWELVE_DATA_API_KEY) {
    return "کلید API دریافت اطلاعات طلا تنظیم نشده است.";
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", "XAU/USD");
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", "100");
  url.searchParams.set("apikey", env.TWELVE_DATA_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.status === "error" || !data.values || data.values.length < 35) {
    console.error("Twelve Data error:", data);
    return "اطلاعات کافی از Twelve Data دریافت نشد. محدودیت API یا کمبود داده ممکن است علت باشد.";
  }

  const candles = data.values.slice().reverse().map(c => ({
    time: c.datetime,
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close)
  }));

  if (candles.some(c => !Number.isFinite(c.close) || !Number.isFinite(c.high) || !Number.isFinite(c.low))) {
    return "داده‌های دریافتی معتبر نیستند. کمی بعد دوباره تلاش کن.";
  }

  const closes = candles.map(c => c.close);
  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const trend = detectTrend(candles);
  const structure = detectStructure(candles);
  const levels = findSupportResistance(candles);

  let rsiText = "متعادل";
  if (rsi >= 70) rsiText = "اشباع خرید";
  else if (rsi <= 30) rsiText = "اشباع فروش";
  else if (rsi > 55) rsiText = "تمایل صعودی";
  else if (rsi < 45) rsiText = "تمایل نزولی";

  let macdText = "خنثی";
  if (macd.histogram > 0) macdText = "مومنتوم مثبت";
  else if (macd.histogram < 0) macdText = "مومنتوم منفی";

  let scenario;

  if (trend === "صعودی" && rsi > 50 && macd.histogram > 0) {
    scenario = "سناریوی صعودی: در صورت حفظ حمایت نزدیک و تأیید کندل، ادامه رشد محتمل است.";
  } else if (trend === "نزولی" && rsi < 50 && macd.histogram < 0) {
    scenario = "سناریوی نزولی: در صورت حفظ فشار فروش و شکست حمایت، افت بیشتر محتمل است.";
  } else {
    scenario = "سناریوی خنثی/انتظار: برای جهت روشن‌تر، منتظر شکست معتبر حمایت یا مقاومت بمان.";
  }

  const change = last.close - previous.close;
  const changePct = previous.close ? (change / previous.close) * 100 : 0;
  const emoji = change > 0 ? "📈" : change < 0 ? "📉" : "➖";

  return (
    `🥇 تحلیل تکنیکال طلای جهانی XAU/USD\n` +
    `تایم‌فریم: ${label}\n` +
    `زمان آخرین کندل: ${last.time}\n\n` +
    `💰 قیمت بسته‌شدن: ${last.close.toFixed(2)}\n` +
    `${emoji} تغییر کندل قبلی: ${change.toFixed(2)} (${changePct.toFixed(3)}%)\n\n` +
    `📈 روند کوتاه‌مدت: ${trend}\n` +
    `🏔️ ساختار بازار: ${structure}\n\n` +
    `🧱 حمایت نزدیک: ${levels.support.toFixed(2)}\n` +
    `🧱 مقاومت نزدیک: ${levels.resistance.toFixed(2)}\n\n` +
    `📊 RSI(14): ${rsi.toFixed(2)} — ${rsiText}\n` +
    `📉 MACD: ${macd.macd.toFixed(3)}\n` +
    `خط سیگنال: ${macd.signal.toFixed(3)}\n` +
    `هیستوگرام: ${macd.histogram.toFixed(3)} — ${macdText}\n\n` +
    `🎯 سناریوی احتمالی:\n${scenario}\n\n` +
    `⚠️ این تحلیل بر پایه داده‌های Twelve Data است و تضمینی برای حرکت آینده نیست. قبل از معامله، قیمت و حد ضرر را در پلتفرم خودت بررسی کن.`
  );
}

function calculateRSI(closes, period = 14) {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(values, period) {
  const multiplier = 2 / (period + 1);
  let ema = values[0];
  const result = [ema];

  for (let i = 1; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    result.push(ema);
  }

  return result;
}

function calculateMACD(closes) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);
  const last = macdLine.length - 1;

  return {
    macd: macdLine[last],
    signal: signalLine[last],
    histogram: macdLine[last] - signalLine[last]
  };
}

function detectTrend(candles) {
  const recent = candles.slice(-20);
  const first = recent[0].close;
  const last = recent[recent.length - 1].close;

  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);

  const higherHighs = highs[highs.length - 1] > highs[0];
  const higherLows = lows[lows.length - 1] > lows[0];
  const lowerHighs = highs[highs.length - 1] < highs[0];
  const lowerLows = lows[lows.length - 1] < lows[0];

  if (last > first && higherHighs && higherLows) return "صعودی";
  if (last < first && lowerHighs && lowerLows) return "نزولی";
  return "خنثی";
}

function detectStructure(candles) {
  const recent = candles.slice(-12);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);

  const firstHigh = Math.max(...highs.slice(0, 6));
  const lastHigh = Math.max(...highs.slice(6));
  const firstLow = Math.min(...lows.slice(0, 6));
  const lastLow = Math.min(...lows.slice(6));

  if (lastHigh > firstHigh && lastLow > firstLow) return "HH + HL (سقف و کف بالاتر)";
  if (lastHigh < firstHigh && lastLow < firstLow) return "LH + LL (سقف و کف پایین‌تر)";
  return "ساختار ترکیبی یا در حال شکل‌گیری";
}

function findSupportResistance(candles) {
  const recent = candles.slice(-30);
  const price = recent[recent.length - 1].close;
  const supports = recent.map(c => c.low).filter(v => v < price);
  const resistances = recent.map(c => c.high).filter(v => v > price);

  return {
    support: supports.length ? Math.max(...supports) : Math.min(...recent.map(c => c.low)),
    resistance: resistances.length ? Math.min(...resistances) : Math.max(...recent.map(c => c.high))
  };
}

async function sendTelegram(token, chatId, text) {
  if (!token) {
    throw new Error("BOT_TOKEN is missing");
  }

  const response = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    console.error("Telegram API error:", response.status, result);
    throw new Error(`Telegram API error: ${response.status} - ${result.description || "Unknown error"}`);
  }
}
