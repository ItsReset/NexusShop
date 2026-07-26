// همه قیمت‌ها به تومان هستن. برای تغییر قیمت‌ها فقط همین‌جا رو ویرایش کن.

const STARS = [
  { code: "stars_50", label: "⭐ 50 stars — 170", desc: "⭐ 50 stars", price: 170 },
  { code: "stars_75", label: "⭐ 75 stars — 250", desc: "⭐ 75 stars", price: 250 },
  { code: "stars_100", label: "⭐ 100 stars — 340", desc: "⭐ 100 stars", price: 340 },
  { code: "stars_150", label: "⭐ 150 stars — 490", desc: "⭐ 150 stars", price: 490 },
  { code: "stars_250", label: "⭐ 250 stars — 800", desc: "⭐ 250 stars", price: 800 },
  { code: "stars_350", label: "⭐ 350 stars — 1,100", desc: "⭐ 350 stars", price: 1100 },
  { code: "stars_500", label: "⭐ 500 stars — 1,550", desc: "⭐ 500 stars", price: 1550 },
  { code: "stars_750", label: "⭐ 750 stars — 2,350", desc: "⭐ 750 stars", price: 2350 },
  { code: "stars_1000", label: "⭐ 1K stars — 3,100", desc: "⭐ 1K stars", price: 3100 }
];

const PREMIUM = [
  { code: "prem_3m", label: "🎁 3 month premium — 2,550", desc: "🎁 3 month premium", price: 2550 },
  { code: "prem_6m", label: "🎁 6 month premium — 3,350", desc: "🎁 6 month premium", price: 3350 },
  { code: "prem_12m", label: "🎁 12 month premium — 6,050", desc: "🎁 12 month premium", price: 6050 }
];

const GIFTS = [
  { code: "gift_bear", label: "🧸 — 48", desc: "🧸", price: 48 },
  { code: "gift_heart", label: "💝 — 48", desc: "💝", price: 48 },
  { code: "gift_box", label: "🎁 — 85", desc: "🎁", price: 85 },
  { code: "gift_rose", label: "🌹 — 85", desc: "🌹", price: 85 },
  { code: "gift_rocket", label: "🚀 — 165", desc: "🚀", price: 165 },
  { code: "gift_bouquet", label: "💐 — 165", desc: "💐", price: 165 },
  { code: "gift_champagne", label: "🍾 — 165", desc: "🍾", price: 165 },
  { code: "gift_cake", label: "🎂 — 165", desc: "🎂", price: 165 },
  { code: "gift_diamond", label: "💎 — 330", desc: "💎", price: 330 },
  { code: "gift_ring", label: "💍 — 330", desc: "💍", price: 330 },
  { code: "gift_trophy", label: "🏆 — 330", desc: "🏆", price: 330 }
];

function findProduct(code) {
  return [...STARS, ...PREMIUM, ...GIFTS].find((p) => p.code === code);
}

module.exports = { STARS, PREMIUM, GIFTS, findProduct };
