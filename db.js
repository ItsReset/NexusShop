const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "db.json");

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (e) {
    return { users: {} };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getUser(chatId) {
  const db = loadDB();
  if (!db.users[chatId]) {
    db.users[chatId] = { balance: 0, orders: [] };
    saveDB(db);
  }
  return db.users[chatId];
}

function addOrder(chatId, order) {
  const db = loadDB();
  if (!db.users[chatId]) db.users[chatId] = { balance: 0, orders: [] };
  const orderWithId = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    status: "در انتظار تایید",
    createdAt: new Date().toISOString(),
    ...order
  };
  db.users[chatId].orders.unshift(orderWithId);
  saveDB(db);
  return orderWithId;
}

function updateOrderStatus(chatId, orderId, status) {
  const db = loadDB();
  const user = db.users[chatId];
  if (!user) return null;
  const order = user.orders.find((o) => o.id === orderId);
  if (!order) return null;
  order.status = status;
  saveDB(db);
  return order;
}

function addBalance(chatId, amount) {
  const db = loadDB();
  if (!db.users[chatId]) db.users[chatId] = { balance: 0, orders: [] };
  db.users[chatId].balance += amount;
  saveDB(db);
  return db.users[chatId].balance;
}

function findOrder(orderId) {
  const db = loadDB();const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "db.json");

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (e) {
    return { users: {} };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getUser(chatId) {
  const db = loadDB();
  if (!db.users[chatId]) {
    db.users[chatId] = { balance: 0, orders: [] };
    saveDB(db);
  }
  return db.users[chatId];
}

function addOrder(chatId, order) {
  const db = loadDB();
  if (!db.users[chatId]) db.users[chatId] = { balance: 0, orders: [] };
  const orderWithId = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    ...order,
    status: order.status || "در انتظار تایید"
  };
  db.users[chatId].orders.unshift(orderWithId);
  saveDB(db);
  return orderWithId;
}

function updateOrderStatus(chatId, orderId, status) {
  const db = loadDB();
  const user = db.users[chatId];
  if (!user) return null;
  const order = user.orders.find((o) => o.id === orderId);
  if (!order) return null;
  order.status = status;
  saveDB(db);
  return order;
}

function addBalance(chatId, amount) {
  const db = loadDB();
  if (!db.users[chatId]) db.users[chatId] = { balance: 0, orders: [] };
  db.users[chatId].balance += amount;
  saveDB(db);
  return db.users[chatId].balance;
}

function findOrder(orderId) {
  const db = loadDB();
  for (const chatId of Object.keys(db.users)) {
    const order = db.users[chatId].orders.find((o) => o.id === orderId);
    if (order) return { chatId, order };
  }
  return null;
}

module.exports = { getUser, addOrder, updateOrderStatus, addBalance, findOrder };

  for (const chatId of Object.keys(db.users)) {
    const order = db.users[chatId].orders.find((o) => o.id === orderId);
    if (order) return { chatId, order };
  }
  return null;
}

module.exports = { getUser, addOrder, updateOrderStatus, addBalance, findOrder };
