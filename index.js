const API_BASE = "https://api.telegram.org";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Himan Gold Bot is running!");
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

    let reply;

    try {
      switch (command) {
        case "/start":
          reply =
            "سلام! به ربات تحلیل طلای هیمن خوش آمدی.\n\n" +
            "فرمان‌ها:\n" +
            "/gold - وضعیت کلی طلا\n" +
            "/m1 - تایم‌فریم یک دقیقه\n" +
            "/m5 - تایم‌فریم پنج دقیقه\n" +
            "/m15 - تایم‌فریم پانزده دقیقه\n" +
            "/h1 - تایم‌فریم یک ساعته\n" +
            "/help - راهنما";
          break;

        case "/help":
          reply =
            "فرمان‌های ربات:\n" +
            "/gold - وضعیت کلی طلا\n" +
            "/m1 - کندل‌های M1\n" +
            "/m5 - کندل‌های M5\n" +
            "/m15 - کندل‌های M15\n" +
            "/h1 - کندل‌های H1";
          break;

        case "/gold":
          reply = await getGold(env, "5min", "M5");
          break;

        case "/m1":
          reply = await getGold(env, "1min", "M1");
          break;

        case "/m5":
          reply = await getGold(env, "5min", "M5");
          break;

        case "/m15":
          reply = await getGold(env, "15min", "M15");
          break;

        case "/h1":
          reply = await getGold(env, "1h", "H1");
          break;

        default:
          reply = "فرمان شناخته نشد. برای راهنما /help را بفرست.";
      }
    } catch (error) {
      reply = "دریافت اطلاعات طلا ناموفق بود. کمی بعد دوباره تلاش کن.";
    }

    await sendTelegram(env.BOT_TOKEN, chatId, reply);
    return new Response("OK");
  },
};

async function getGold(env, interval, label) {
  if (!env.TWELVE_DATA_API_KEY) {
    return "کلید API دریافت اطلاعات طلا تنظیم نشده است.";
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", "XAU/USD");
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", "10");
  url.searchParams.set("apikey", env.TWELVE_DATA_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.status === "error" || !data.values?.length) {
    return "در حال حاضر اطلاعات کندل‌های طلا دریافت نشد. ممکن است محدودیت API فعال شده باشد.";
  }

  const candles = data.values;
  const latest = candles[0];
  const previous = candles[1];

  const current = Number(latest.close);
  const prior = Number(previous.close);
  const change = current - prior;

  const direction =
    change > 0 ? "صعودی" : change < 0 ? "نزولی" : "بدون تغییر";

  const trendEmoji = change > 0 ? "📈" : change < 0 ? "📉" : "➖";

  const candleText = candles
    .slice(0, 5)
    .map((c) => {
      return `${c.datetime}\nباز: ${c.open} | بالا: ${c.high}\nپایین: ${c.low} | بسته: ${c.close}`;
    })
    .join("\n\n");

  return (
    `🥇 تحلیل اولیه طلا XAU/USD\n` +
    `تایم‌فریم: ${label}\n\n` +
    `${trendEmoji} جهت آخرین تغییر: ${direction}\n` +
    `قیمت بسته‌شدن آخرین کندل: ${latest.close}\n` +
    `تغییر نسبت به کندل قبلی: ${change.toFixed(2)}\n` +
    `زمان آخرین کندل: ${latest.datetime}\n\n` +
    `📊 پنج کندل اخیر:\n${candleText}\n\n` +
    `توجه: این گزارش خلاصه داده‌های کندل است و سیگنال قطعی خرید یا فروش نیست.`
  );
}

async function sendTelegram(token, chatId, text) {
  const response = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error("Telegram message failed");
  }
}
