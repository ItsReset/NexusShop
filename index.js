const express = require("express");
const app = express();
app.use(express.json());

const { getUser, addOrder, updateOrderStatus, addBalance, findOrder } = require("./db");
const { STARS, PREMIUM, GIFTS, findProduct } = require("./catalog");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // your own Telegram chat id, to receive receipts
const CARD_NUMBER = process.env.CARD_NUMBER || "6219861406755743";
const CARD_HOLDER = process.env.CARD_HOLDER || "";
const PORT = process.env.PORT || 3000;

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// In-memory per-chat state (resets if server restarts)
// state[chatId] = { step: "awaiting_amount" | "awaiting_receipt", order: {...} }
const state = {};

// Tracks the message_id of the current "screen" per chat, so we can replace it
// instead of stacking a new message every time.
const lastScreenMessageId = {};

// ---------- Telegram API helpers ----------

async function sendMessage(chatId, text, replyMarkup) {
  const body = { chat_id: chatId, text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function editMessageText(chatId, messageId, text, keyboard) {
  const res = await fetch(`${API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: keyboard || { inline_keyboard: [] }
    })
  });
  return res.json();
}

async function deleteMessage(chatId, messageId) {
  try {
    await fetch(`${API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
  } catch (e) {
    // ignore - message may already be gone or too old to delete
  }
}

function inlineKb(rows) {
  return { inline_keyboard: rows };
}

const persistentKeyboard = {
  keyboard: [[{ text: "🏠 Menu" }]],
  resize_keyboard: true,
  is_persistent: true
};

// Shows a "screen" to the user: edits the previous screen message if this came
// from a button click (cq), otherwise deletes the old screen message and sends
// a fresh one (used when the user replies with free text, e.g. an amount or receipt).
async function showScreen(chatId, text, keyboard, cq) {
  if (cq) {
    const result = await editMessageText(chatId, cq.message.message_id, text, keyboard);
    if (result.ok) {
      lastScreenMessageId[chatId] = cq.message.message_id;
      return;
    }
    // fall through to send-new if edit failed (e.g. message too old)
  } else {
    const oldId = lastScreenMessageId[chatId];
    if (oldId) await deleteMessage(chatId, oldId);
  }

  const sent = await sendMessage(chatId, text, keyboard);
  if (sent.ok) lastScreenMessageId[chatId] = sent.result.message_id;
}

async function forwardToAdmin(chatId, text, orderId, withApproval) {
  if (!ADMIN_CHAT_ID) return;
  const markup = withApproval
    ? inlineKb([
        [
          { text: "✅ تایید", callback_data: `approve_${chatId}_${orderId}` },
          { text: "❌ رد", callback_data: `reject_${chatId}_${orderId}` }
        ]
      ])
    : undefined;
  await sendMessage(ADMIN_CHAT_ID, `📩 کاربر ${chatId}\n\n${text}`, markup);
}

async function forwardPhotoToAdmin(chatId, fileId, caption, orderId) {
  if (!ADMIN_CHAT_ID) return;
  await fetch(`${API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      photo: fileId,
      caption: `📩 رسید جدید از کاربر ${chatId}\n\n${caption}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ تایید", callback_data: `approve_${chatId}_${orderId}` },
            { text: "❌ رد", callback_data: `reject_${chatId}_${orderId}` }
          ]
        ]
      }
    })
  });
}

async function answerCallback(callbackQueryId) {
  await fetch(`${API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  });
}

// ---------- Keyboards ----------

const mainMenuKeyboard = inlineKb([
  [{ text: "💰 افزایش موجودی", callback_data: "menu_deposit" }],
  [{ text: "🛍 خدمات تلگرام", callback_data: "menu_services" }],
  [{ text: "👤 حساب کاربری", callback_data: "menu_account" }]
]);

const servicesMenuKeyboard = inlineKb([
  [{ text: "⭐ استارز تلگرام", callback_data: "svc_stars" }],
  [{ text: "📱 شماره مجازی", callback_data: "svc_number" }],
  [{ text: "💎 پرمیوم تلگرام", callback_data: "svc_premium" }],
  [{ text: "🎁 گیفت تلگرام", callback_data: "svc_gift" }],
  [{ text: "🔙 بازگشت", callback_data: "menu_back" }]
]);

function productKeyboard(products) {
  const rows = products.map((p) => [{ text: p.label, callback_data: `buy_${p.code}` }]);
  rows.push([{ text: "🔙 بازگشت", callback_data: "menu_services" }]);
  return inlineKb(rows);
}

function insufficientBalanceKeyboard() {
  return inlineKb([
    [{ text: "💰 افزایش موجودی", callback_data: "menu_deposit" }],
    [{ text: "🔙 بازگشت", callback_data: "menu_services" }]
  ]);
}

// ---------- Order flow helpers ----------

async function handlePurchase(chatId, product, cq) {
  const user = getUser(chatId);
  if (user.balance < product.price) {
    await showScreen(
      chatId,
      `موجودی شما کافی نیست 😔\nموجودی فعلی: ${user.balance.toLocaleString("fa-IR")} تومان\nقیمت ${product.desc}: ${product.price.toLocaleString("fa-IR")} تومان\n\nلطفاً ابتدا موجودی خودتون رو افزایش بدید.`,
      insufficientBalanceKeyboard(),
      cq
    );
    return;
  }

  addBalance(chatId, -product.price);
  const order = addOrder(chatId, {
    type: "purchase",
    description: product.desc,
    amount: product.price,
    status: "در حال انجام"
  });

  await showScreen(chatId, "✅ درخواست شما ثبت شد و خریدتون در اسرع وقت انجام میشه ♥️", mainMenuKeyboard, cq);
  await forwardToAdmin(
    chatId,
    `🛒 خرید جدید (از موجودی): ${product.desc} — ${product.price.toLocaleString("fa-IR")} تومان\nشناسه سفارش: ${order.id}`,
    order.id,
    false
  );
}

async function finalizeTopup(chatId, receiptText, receiptFileId) {
  const pending = state[chatId];
  if (!pending || pending.step !== "awaiting_receipt") return false;

  const order = addOrder(chatId, {
    ...pending.order,
    receiptFileId: receiptFileId || null,
    receiptText: receiptText || null
  });

  const summary = `درخواست افزایش موجودی به مبلغ ${pending.order.amount}`;

  if (receiptFileId) {
    await forwardPhotoToAdmin(chatId, receiptFileId, summary, order.id);
  } else {
    await forwardToAdmin(chatId, `${summary}\n\nرسید: ${receiptText}`, order.id, true);
  }

  await showScreen(
    chatId,
    "رسید شما دریافت شد و برای بررسی ارسال گردید. لطفاً منتظر تایید ادمین بمانید ♥️",
    mainMenuKeyboard,
    null // came from a text message, not a button click
  );
  delete state[chatId];
  return true;
}

async function showMainMenu(chatId, cq) {
  delete state[chatId];
  await showScreen(chatId, "منوی اصلی:", mainMenuKeyboard, cq);
}

// ---------- Webhook ----------

app.post("/telegram-webhook", async (req, res) => {
  try {
    const update = req.body;

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;
      await answerCallback(cq.id);

      if (data === "menu_back") {
        await showMainMenu(chatId, cq);
      } else if (data === "menu_deposit") {
        state[chatId] = { step: "awaiting_amount", order: { type: "topup" } };
        await showScreen(chatId, "برای افزایش موجودی مبلغ مورد نیازتون رو ارسال کنید.", undefined, cq);
      } else if (data === "menu_services") {
        await showScreen(chatId, "یکی از خدمات زیر رو انتخاب کنید:", servicesMenuKeyboard, cq);
      } else if (data === "menu_account") {
        const user = getUser(chatId);
        let text = `👤 حساب کاربری شما\n\nموجودی فعلی: ${user.balance.toLocaleString("fa-IR")} تومان\n\n`;
        if (user.orders.length === 0) {
          text += "تاریخچه سفارشی ندارید.";
        } else {
          text += "آخرین سفارش‌ها:\n";
          user.orders.slice(0, 5).forEach((o) => {
            const desc = o.type === "topup" ? "افزایش موجودی" : o.description;
            text += `• ${desc} — ${o.amount.toLocaleString("fa-IR")} تومان — ${o.status}\n`;
          });
        }
        await showScreen(chatId, text, mainMenuKeyboard, cq);
      } else if (data === "svc_stars") {
        await showScreen(chatId, "⭐ Stars", productKeyboard(STARS), cq);
      } else if (data === "svc_premium") {
        await showScreen(
          chatId,
          "❗دقت کنید تمام سفارشات تلگرام نیازی به ورود به اکانت نیست و به صورت گیفت برای شما فرستاده میشه.",
          productKeyboard(PREMIUM),
          cq
        );
      } else if (data === "svc_gift") {
        await showScreen(chatId, "🎁 گیفت تلگرام", productKeyboard(GIFTS), cq);
      } else if (data === "svc_number") {
        await showScreen(chatId, "🛒 برای خرید و استعلام قیمت شماره مجازی به آیدی @Its_Cavallo پیام بدهید ♥️", servicesMenuKeyboard, cq);
      } else if (data.startsWith("buy_")) {
        const code = data.replace("buy_", "");
        const product = findProduct(code);
        if (product) await handlePurchase(chatId, product, cq);
      } else if (data.startsWith("approve_") || data.startsWith("reject_")) {
        // admin-only actions (for balance top-up approvals)
        if (String(cq.from.id) !== String(ADMIN_CHAT_ID)) return res.sendStatus(200);
        const [action, targetChatId, orderId] = data.split("_");
        if (action === "approve") {
          const order = updateOrderStatus(targetChatId, orderId, "تایید شد");
          if (order) {
            const newBalance = addBalance(targetChatId, order.amount);
            await sendMessage(
              targetChatId,
              `✅ سفارش شما تایید شد.\nموجودی جدید: ${newBalance.toLocaleString("fa-IR")} تومان`
            );
            await sendMessage(ADMIN_CHAT_ID, `سفارش ${orderId} تایید و موجودی کاربر ${targetChatId} افزایش یافت.`);
          }
        } else {
          const order = updateOrderStatus(targetChatId, orderId, "رد شد");
          if (order) {
            await sendMessage(targetChatId, "❌ متاسفانه رسید شما تایید نشد. لطفاً با پشتیبانی در ارتباط باشید.");
            await sendMessage(ADMIN_CHAT_ID, `سفارش ${orderId} رد شد.`);
          }
        }
      }
      return res.sendStatus(200);
    }

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;

      if (msg.text === "/start") {
        delete state[chatId];
        delete lastScreenMessageId[chatId];
        await sendMessage(chatId, "سلام 👋 خوش اومدید!", persistentKeyboard);
        const sent = await sendMessage(chatId, "یکی از گزینه‌های زیر رو انتخاب کنید:", mainMenuKeyboard);
        if (sent.ok) lastScreenMessageId[chatId] = sent.result.message_id;
        return res.sendStatus(200);
      }

      if (msg.text === "🏠 Menu") {
        await showMainMenu(chatId, null);
        return res.sendStatus(200);
      }

      const pending = state[chatId];
      if (pending && pending.step === "awaiting_amount" && msg.text) {
        pending.order.amount = msg.text.trim();
        pending.step = "awaiting_receipt";
        await showScreen(
          chatId,
          `💳 ${CARD_NUMBER}\n${CARD_HOLDER}\n\nرسید واریز رو ارسال کنید و منتظر تایید باشید.\nتشکر از صبر و شکیبایی شما ♥️✨`,
          undefined,
          null
        );
        return res.sendStatus(200);
      }

      if (pending && pending.step === "awaiting_receipt") {
        if (msg.photo && msg.photo.length > 0) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          await finalizeTopup(chatId, null, fileId);
        } else if (msg.text) {
          await finalizeTopup(chatId, msg.text, null);
        }
        return res.sendStatus(200);
      }

      // Fallback: show main menu for any other message
      await showMainMenu(chatId, null);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200);
  }
});

app.get("/", (req, res) => res.send("Telegram store bot is running."));

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
