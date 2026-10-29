import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import process from "node:process";
import db from "./db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { Resend } from "resend";
import axios from "axios";
import { Buffer } from "node:buffer";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const app = express();

// ============================================================
// ENV VALIDATION
// ============================================================
function validateMpesaEnv() {
  const required = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
    "MPESA_CALLBACK_URL",
  ];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error("❌ Missing M-Pesa env vars:", missing.join(", "));
    return false;
  }
  for (const k of required) {
    const v = process.env[k];
    if (v !== v.trim() || v.startsWith('"') || v.startsWith("'")) {
      console.error(`❌ ${k} has stray whitespace or quotes.`);
      return false;
    }
  }
  const cb = process.env.MPESA_CALLBACK_URL;
  if (!/^https:\/\//.test(cb) || cb.includes("localhost")) {
    console.error(`❌ MPESA_CALLBACK_URL must be a public HTTPS URL (got: ${cb})`);
    console.error("   → Run `ngrok http 5000` and put the https URL in .env");
    return false;
  }
  console.log("✅ M-Pesa env validated. Callback:", cb);
  return true;
}
validateMpesaEnv();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
  })
);
app.use(express.json());

// ============================================================
// M-PESA HELPERS
// ============================================================
let mpesaTokenCache = { value: null, expiresAt: 0 };

async function getMpesaAccessToken() {
  if (mpesaTokenCache.value && Date.now() < mpesaTokenCache.expiresAt) {
    return mpesaTokenCache.value;
  }
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa credentials are not configured.");
  }
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  try {
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${credentials}` }, timeout: 15000 }
    );
    mpesaTokenCache = {
      value: response.data.access_token,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
    console.log("Daraja OAuth OK");
    return mpesaTokenCache.value;
  } catch (error) {
    console.error("Daraja OAuth failed:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
}

function getMpesaTimestamp() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const v = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return v.year + v.month + v.day + v.hour + v.minute + v.second;
}

function normalizeKenyanPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  let phone = digits;
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  else if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;
  else if (!phone.startsWith("254") && phone.length === 9) phone = "254" + phone;
  return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

// SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" (UTC, no T/Z).
// Convert to ISO-8601 UTC so the frontend can parse it reliably.
function toUtcIso(v) {
  if (v == null) return v;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  if (!s) return s;
  // Already has timezone info → trust it.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString();
  }
  // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" → treat as UTC.
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(iso + "Z");
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

// ============================================================
// HEALTH + DIAGNOSTICS
// ============================================================
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "E-commerce backend is running" });
});

app.get("/api/mpesa/config-check", (req, res) => {
  res.json({
    consumerKeyLoaded: Boolean(process.env.MPESA_CONSUMER_KEY?.trim()),
    consumerSecretLoaded: Boolean(process.env.MPESA_CONSUMER_SECRET?.trim()),
    shortcodeLoaded: Boolean(process.env.MPESA_SHORTCODE?.trim()),
    passkeyLoaded: Boolean(process.env.MPESA_PASSKEY?.trim()),
    callbackUrlLoaded: Boolean(process.env.MPESA_CALLBACK_URL?.trim()),
    callbackUrl: process.env.MPESA_CALLBACK_URL || null,
    shortcode: process.env.MPESA_SHORTCODE || null,
    transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
  });
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ success: false, message: "Please log in." });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, message: "Server auth not configured." });
  }
  try {
    const payload = jwt.verify(token, secret);
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Invalid token." });
    }
    const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Session expired. Log in again." });
  }
}

function authorizeAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required." });
  }
  next();
}

// ============================================================
// PRODUCTS
// ============================================================
app.get("/api/products", (req, res) => {
  try {
    const products = db.prepare("SELECT * FROM products ORDER BY id").all();
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

app.get("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }
  try {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (error) {
    console.error("Failed to fetch product:", error);
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
});

// ============================================================
// AUTH
// ============================================================
app.post("/api/auth/register", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body.password;

  if (!name || !email || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Name, email, and password are required." });
  }
  if (name.length > 100 || email.length > 254) {
    return res.status(400).json({ success: false, message: "Name or email too long." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email." });
  }
  if (password.length < 6 || password.length > 12) {
    return res.status(400).json({ success: false, message: "Password must be 6–12 characters." });
  }

  try {
    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already exists." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
    ).run(name, email, passwordHash);

    const user = { id: Number(result.lastInsertRowid), name, email, role: "customer" };
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === "replace_with_a_long_random_secret") {
      return res.status(500).json({ success: false, message: "Server auth not configured." });
    }
    const token = jwt.sign({ sub: String(user.id), role: user.role }, secret, { expiresIn: "2h" });
    return res.status(201).json({ success: true, message: "Account created.", token, user });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ success: false, message: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body.password;
  if (!email || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }
  try {
    const userRecord = db.prepare(
      "SELECT id, name, email, password_hash, role FROM users WHERE email = ?"
    ).get(email);
    if (!userRecord || !(await bcrypt.compare(password, userRecord.password_hash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === "replace_with_a_long_random_secret") {
      return res.status(500).json({ success: false, message: "Server auth not configured." });
    }
    const user = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
    };
    const token = jwt.sign({ sub: String(user.id), role: user.role }, secret, { expiresIn: "2h" });
    return res.json({ success: true, message: "Login successful.", token, user });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Could not log in." });
  }
});

const resetTokenHash = (token) => createHash("sha256").update(token).digest("hex");

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) return res.status(400).json({ success: false, message: "Email is required." });
  try {
    const account = db.prepare("SELECT id, email FROM users WHERE email = ?").get(email);
    const response = {
      success: true,
      message: "If that account exists, a password-reset email has been requested.",
    };
    if (!account) return res.json(response);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = resetTokenHash(token);
    const expiresAt = Date.now() + 15 * 60 * 1000;

    db.transaction(() => {
      db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(account.id);
      db.prepare(
        "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
      ).run(account.id, tokenHash, expiresAt);
    })();

    const resetUrl = new URL("/reset-password", process.env.CLIENT_URL || "http://localhost:5173");
    resetUrl.searchParams.set("token", token);

    const { data, error } = await resend.emails.send({
      from: "ShopHub <onboarding@resend.dev>",
      to: [account.email],
      subject: "Reset your ShopHub password",
      text: `Reset link: ${resetUrl.toString()}`,
      html: `<p><a href="${resetUrl.toString()}">Reset Password</a></p>`,
    });
    if (error) throw new Error(error.message);
    console.log("Password-reset email sent:", data?.id);
    return res.json(response);
  } catch (error) {
    console.error("Password-reset email failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not send the reset email." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body ?? {};
  if (
    typeof token !== "string" || token.length > 200 ||
    typeof newPassword !== "string" ||
    newPassword.length < 6 || newPassword.length > 12
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid reset token and a password of 6–12 characters.",
    });
  }
  try {
    const tokenHash = resetTokenHash(token);
    const reset = db.prepare(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`
    ).get(tokenHash, Date.now());
    if (!reset) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid, expired, or already used.",
      });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const ok = db.transaction(() => {
      const valid = db.prepare(
        `SELECT id FROM password_resets
         WHERE id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > ?`
      ).get(reset.id, tokenHash, Date.now());
      if (!valid) return false;
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, reset.user_id);
      db.prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(Date.now(), reset.id);
      db.prepare("DELETE FROM password_resets WHERE user_id = ? AND id != ?").run(reset.user_id, reset.id);
      return true;
    })();
    if (!ok) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid, expired, or already used.",
      });
    }
    return res.json({ success: true, message: "Password changed successfully. You can now log in." });
  } catch (error) {
    console.error("Password reset failed:", error);
    return res.status(500).json({ success: false, message: "Could not reset the password." });
  }
});

// ============================================================
// ORDERS
// ============================================================
app.post("/api/orders", authenticateToken, (req, res) => {
  const { customer, items } = req.body || {};
  const paymentMethod = String(customer?.paymentMethod || "Cash on Delivery").trim();
  if (!["M-Pesa", "Cash on Delivery"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "Invalid payment method." });
  }
  const customerName = String(req.user.name || "").trim();
  const customerEmail = String(req.user.email || "").trim();
  const deliveryAddress = String(customer?.address ?? customer?.deliveryAddress ?? "").trim();

  if (
    !customerName || !customerEmail || !deliveryAddress ||
    !Array.isArray(items) || items.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Customer details and order items are required.",
    });
  }

  try {
    const orderItems = items.map((item) => {
      const productId = Number(item.productId ?? item.id);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || productId <= 0 ||
          !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("A product ID or quantity is invalid.");
      }
      const product = db.prepare(
        "SELECT id, name, price, image_url FROM products WHERE id = ?"
      ).get(productId);
      if (!product) throw new Error(`Product ID ${productId} not found.`);
      return {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        quantity,
        image: product.image_url,
      };
    });

    const total = Math.round(
      orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
    ) / 100;

    const initialPaymentStatus =
      paymentMethod === "Cash on Delivery" ? "Pending" : "Unpaid";

    const saveOrder = db.transaction(() => {
      const reserveStock = db.prepare(
        "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
      );
      for (const item of orderItems) {
        const result = reserveStock.run(item.quantity, item.productId, item.quantity);
        if (result.changes !== 1) {
          throw new Error(`Insufficient stock for product ID ${item.productId}.`);
        }
      }
      const result = db.prepare(`
        INSERT INTO orders (
          user_id, customer_name, customer_email, delivery_address,
          total, status, payment_status, payment_method, created_at
        )
        VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, CURRENT_TIMESTAMP)
      `).run(
        req.user.id, customerName, customerEmail, deliveryAddress,
        total, initialPaymentStatus, paymentMethod
      );
      const orderDbId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const item of orderItems) {
        insertItem.run(orderDbId, item.productId, item.name, item.price, item.quantity);
      }
      return orderDbId;
    });

    const orderDbId = saveOrder();
    const saved = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderDbId);
    console.log("Order saved:", orderDbId, "payment:", paymentMethod);

    return res.status(201).json({
      success: true,
      order: {
        id: `ORD-${orderDbId}`,
        dbId: orderDbId,
        customer: {
          name: saved.customer_name,
          email: saved.customer_email,
          address: saved.delivery_address,
        },
        items: orderItems.map((item) => ({
          id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        total: saved.total,
        status: saved.status,
        paymentStatus: saved.payment_status,
        paymentMethod: saved.payment_method,
        createdAt: toUtcIso(saved.created_at),
      },
    });
  } catch (error) {
    console.error("Order creation failed:", error);
    const isUserError = ["Product ID", "quantity", "product ID", "Insufficient stock"]
      .some((s) => error.message.includes(s));
    return res.status(isUserError ? 400 : 500).json({
      success: false,
      message: error.message || "Unable to save order.",
    });
  }
});

app.get("/api/orders", authenticateToken, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT id, user_id, customer_name, customer_email, delivery_address,
             total, status, payment_status, payment_method, created_at
      FROM orders WHERE user_id = ? ORDER BY id DESC
    `).all(req.user.id);

    const getItems = db.prepare(`
      SELECT oi.product_id, oi.product_name, oi.unit_price, oi.quantity, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `);

    const getTx = db.prepare(`
      SELECT checkout_request_id, mpesa_receipt_number, result_description, status, updated_at
      FROM mpesa_transactions WHERE order_id = ? ORDER BY id DESC LIMIT 1
    `);

    const result = orders.map((order) => {
      const tx = getTx.get(order.id);
      return {
        id: `ORD-${order.id}`,
        dbId: order.id,
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          address: order.delivery_address,
        },
        items: getItems.all(order.id).map((item) => ({
          id: item.product_id,
          name: item.product_name,
          price: item.unit_price,
          quantity: item.quantity,
          image: item.image_url || "",
        })),
        total: order.total,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        createdAt: toUtcIso(order.created_at),
        mpesa: tx
          ? {
              checkoutRequestId: tx.checkout_request_id || null,
              receipt: tx.mpesa_receipt_number || null,
              resultDesc: tx.result_description || null,
              txStatus: tx.status,
              updatedAt: toUtcIso(tx.updated_at),
            }
          : null,
      };
    });

    return res.json({ success: true, orders: result });
  } catch (error) {
    console.error("Get customer orders failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load your orders." });
  }
});

// ============================================================
// STK PUSH
// ============================================================
app.post("/api/mpesa/stkpush", authenticateToken, async (req, res) => {
  try {
    const orderId = Number(req.body?.orderId);
    const phoneNumber = String(req.body?.phoneNumber || "").trim();
    console.log("STK Push request:", { orderId, phoneNumber, user: req.user.id });

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ success: false, message: "A valid order ID is required." });
    }

    const stkPhone = normalizeKenyanPhone(phoneNumber);
    if (!stkPhone) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid Kenyan phone number (e.g. 0712345678).",
      });
    }

    const order = db.prepare(
      "SELECT id, user_id, total, payment_status FROM orders WHERE id = ?"
    ).get(orderId);

    if (!order || Number(order.user_id) !== Number(req.user.id)) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    if (order.payment_status === "Paid") {
      return res.status(409).json({ success: false, message: "Order already paid." });
    }

    // Expire stale pending tx (>2 min old) so user can retry
    db.prepare(`
      UPDATE mpesa_transactions
      SET status = 'Failed',
          result_code = 'TIMEOUT',
          result_description = 'No callback received within 2 minutes.',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND status = 'Pending'
        AND datetime(created_at) <= datetime('now', '-2 minutes')
    `).run(orderId);

    const existingPending = db.prepare(`
      SELECT id FROM mpesa_transactions
      WHERE order_id = ? AND status = 'Pending'
    `).get(orderId);

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: "A payment request is already pending. Check your phone.",
      });
    }

    const amount = Math.ceil(Number(order.total));
    if (!Number.isSafeInteger(amount) || amount < 1) {
      return res.status(400).json({ success: false, message: "Order total must be at least KSh 1." });
    }

    const shortcode = process.env.MPESA_SHORTCODE.trim();
    const passkey = process.env.MPESA_PASSKEY.trim();
    const callbackUrl = process.env.MPESA_CALLBACK_URL.trim();
    const transactionType = process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline";

    const timestamp = getMpesaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
    const accessToken = await getMpesaAccessToken();
    const accountReference = `S${order.id}`.slice(0, 12);

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: amount,
      PartyA: stkPhone,
      PartyB: shortcode,
      PhoneNumber: stkPhone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: `Order ${order.id} payment`.slice(0, 100),
    };

    console.log("STK payload:", { ...payload, Password: "***" });

    const stkResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 45000,
      }
    );

    const data = stkResponse.data;
    console.log("STK Response:", data);

    if (data.ResponseCode !== "0" || !data.CheckoutRequestID) {
      return res.status(502).json({
        success: false,
        message:
          data.errorMessage ||
          data.ResponseDescription ||
          "M-Pesa rejected the request.",
      });
    }

    db.prepare(`
      INSERT INTO mpesa_transactions (
        order_id, merchant_request_id, checkout_request_id,
        phone_number, amount, status
      ) VALUES (?, ?, ?, ?, ?, 'Pending')
    `).run(
      order.id,
      data.MerchantRequestID || null,
      data.CheckoutRequestID,
      stkPhone,
      amount
    );

    return res.status(200).json({
      success: true,
      message: data.CustomerMessage || "STK Push sent.",
      checkoutRequestId: data.CheckoutRequestID,
      customerMessage: data.CustomerMessage || null,
    });
  } catch (error) {
    console.error("STK Push failed:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return res.status(500).json({
      success: false,
      message: error.response?.data?.errorMessage || "Unable to initiate M-Pesa payment.",
    });
  }
});

// ============================================================
// CALLBACK
// ============================================================
app.post("/api/mpesa/callback", (req, res) => {
  // Respond 200 immediately — Safaricom requires fast ack
  res.status(200).json({ ResultCode: 0, ResultDesc: "Callback received" });

  try {
    console.log("📞 Callback:", JSON.stringify(req.body, null, 2));

    const callback = req.body?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID) {
      console.error("Invalid callback payload.");
      return;
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
    const resultCode = String(ResultCode);

    const transaction = db.prepare(
      "SELECT id, order_id, status FROM mpesa_transactions WHERE checkout_request_id = ?"
    ).get(CheckoutRequestID);

    if (!transaction) {
      console.error("No transaction for CheckoutRequestID:", CheckoutRequestID);
      return;
    }
    if (transaction.status !== "Pending") {
      console.log("Transaction already final:", transaction.status);
      return;
    }

    const items = CallbackMetadata?.Item || [];
    const getItem = (name) => items.find((i) => i.Name === name)?.Value;
    const receipt = getItem("MpesaReceiptNumber");

    const processCallback = db.transaction(() => {
      if (resultCode === "0") {
        if (!receipt) {
          db.prepare(`
            UPDATE mpesa_transactions
            SET status = 'Failed', result_code = ?, result_description = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'Pending'
          `).run("NO_RECEIPT", "No MpesaReceiptNumber in callback", transaction.id);
          db.prepare(`
            UPDATE orders SET payment_status = 'Failed'
            WHERE id = ? AND payment_status != 'Paid'
          `).run(transaction.order_id);
          return "failed_no_receipt";
        }

        db.prepare(`
          UPDATE mpesa_transactions
          SET status = 'Paid', mpesa_receipt_number = ?,
              result_code = ?, result_description = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'Pending'
        `).run(receipt, resultCode, ResultDesc, transaction.id);

        db.prepare(`
          UPDATE orders SET payment_status = 'Paid', status = 'Processing'
          WHERE id = ?
        `).run(transaction.order_id);

        return "paid";
      }

      const newStatus = resultCode === "1032" ? "Cancelled" : "Failed";
      db.prepare(`
        UPDATE mpesa_transactions
        SET status = ?, result_code = ?, result_description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'Pending'
      `).run(newStatus, resultCode, ResultDesc, transaction.id);

      db.prepare(`
        UPDATE orders SET payment_status = ?
        WHERE id = ? AND payment_status != 'Paid'
      `).run(newStatus, transaction.order_id);

      return newStatus.toLowerCase();
    });

    const outcome = processCallback();
    console.log("✅ Callback outcome:", outcome, "order:", transaction.order_id);
  } catch (error) {
    console.error("Callback processing failed:", error.message);
  }
});

// ============================================================
// STATUS POLLING
// ============================================================
app.get("/api/mpesa/status/:checkoutRequestId", authenticateToken, (req, res) => {
  try {
    const tx = db.prepare(`
      SELECT mt.status, mt.mpesa_receipt_number, mt.result_description,
             mt.order_id, mt.updated_at, o.payment_status, o.user_id
      FROM mpesa_transactions mt
      JOIN orders o ON o.id = mt.order_id
      WHERE mt.checkout_request_id = ?
    `).get(req.params.checkoutRequestId);

    if (!tx) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }
    if (Number(tx.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: "Not your transaction." });
    }

    // --- Reconciliation: transaction says Paid, order row wasn't updated.
    // Happens when the Daraja callback never arrives (sandbox, network drop).
    if (tx.status === "Paid" && tx.payment_status !== "Paid") {
      try {
        db.prepare(`
          UPDATE orders
          SET payment_status = 'Paid',
              status = CASE WHEN status = 'Pending' THEN 'Processing' ELSE status END
          WHERE id = ? AND payment_status != 'Paid'
        `).run(tx.order_id);
        console.log("Reconciled order from polling:", tx.order_id);
      } catch (reconErr) {
        console.error("Reconciliation failed:", reconErr.message);
      }
    }

    // --- Reconciliation: transaction Failed/Cancelled, order row still open.
    if (
      (tx.status === "Failed" || tx.status === "Cancelled") &&
      (tx.payment_status === "Unpaid" || tx.payment_status === "Pending")
    ) {
      try {
        db.prepare(`
          UPDATE orders SET payment_status = ?
          WHERE id = ? AND payment_status != 'Paid'
        `).run(tx.status, tx.order_id);
      } catch (reconErr) {
        console.error("Reconciliation (failure) failed:", reconErr.message);
      }
    }

    const statusMap = {
      Pending: "pending",
      Paid: "paid",
      Failed: "failed",
      Cancelled: "cancelled",
    };

    return res.json({
      success: true,
      status: statusMap[tx.status] || "pending",
      mpesaReceipt: tx.mpesa_receipt_number || null,
      resultDesc: tx.result_description || null,
      orderId: `ORD-${tx.order_id}`,
      updatedAt: toUtcIso(tx.updated_at),
    });
  } catch (error) {
    console.error("Status check failed:", error);
    return res.status(500).json({ success: false, message: "Unable to check status." });
  }
});

// ============================================================
// ADMIN — PRODUCTS
// ============================================================
app.post("/api/products", authenticateToken, authorizeAdmin, (req, res) => {
  const { name, description = "", price, category, stock, image_url = "" } = req.body || {};
  const productName = typeof name === "string" ? name.trim() : "";
  const productCategory = typeof category === "string" ? category.trim() : "";
  const productPrice = Number(price);
  const productStock = Number(stock);

  if (
    !productName || !productCategory || price === undefined || price === null ||
    price === "" || !Number.isFinite(productPrice) || productPrice < 0 ||
    stock === undefined || stock === null || stock === "" ||
    !Number.isInteger(productStock) || productStock < 0 ||
    typeof description !== "string" || typeof image_url !== "string"
  ) {
    return res.status(400).json({ success: false, message: "Please provide valid product details." });
  }

  try {
    const result = db.prepare(`
      INSERT INTO products (name, description, price, category, stock, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(productName, description.trim(), productPrice, productCategory, productStock, image_url.trim());
    const product = db.prepare("SELECT * FROM products WHERE id = ?")
      .get(Number(result.lastInsertRowid));
    return res.status(201).json({ success: true, message: "Product created.", product });
  } catch (error) {
    console.error("Product creation failed:", error);
    return res.status(500).json({ success: false, message: "Unable to create product." });
  }
});

app.put("/api/products/:id", authenticateToken, authorizeAdmin, (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid product ID." });
  }
  const { name, description = "", price, category, stock, image_url = "" } = req.body || {};
  const productName = typeof name === "string" ? name.trim() : "";
  const productCategory = typeof category === "string" ? category.trim() : "";
  const productPrice = Number(price);
  const productStock = Number(stock);

  if (
    !productName || !productCategory || price === undefined || price === null ||
    price === "" || !Number.isFinite(productPrice) || productPrice < 0 ||
    stock === undefined || stock === null || stock === "" ||
    !Number.isInteger(productStock) || productStock < 0 ||
    typeof description !== "string" || typeof image_url !== "string"
  ) {
    return res.status(400).json({ success: false, message: "Please provide valid product details." });
  }

  try {
    const result = db.prepare(`
      UPDATE products SET name = ?, description = ?, price = ?, category = ?,
                          stock = ?, image_url = ? WHERE id = ?
    `).run(productName, description.trim(), productPrice, productCategory, productStock, image_url.trim(), productId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    return res.json({ success: true, message: "Product updated.", product });
  } catch (error) {
    console.error("Product update failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update product." });
  }
});

app.delete("/api/products/:id", authenticateToken, authorizeAdmin, (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid product ID." });
  }
  try {
    const result = db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    return res.json({ success: true, message: "Product deleted.", productId });
  } catch (error) {
    console.error("Product deletion failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete product." });
  }
});

// ============================================================
// ADMIN — ORDERS (with M-Pesa details)
// ============================================================
app.get("/api/admin/orders", authenticateToken, authorizeAdmin, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT id, user_id, customer_name, customer_email, delivery_address,
             total, status, payment_status, payment_method, created_at
      FROM orders ORDER BY id DESC
    `).all();

    const getItems = db.prepare(`
      SELECT oi.product_id, oi.product_name, oi.unit_price, oi.quantity, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `);

    const getTx = db.prepare(`
      SELECT checkout_request_id, merchant_request_id, mpesa_receipt_number,
             result_code, result_description, status, phone_number, amount,
             created_at, updated_at
      FROM mpesa_transactions WHERE order_id = ? ORDER BY id DESC LIMIT 1
    `);

    const result = orders.map((order) => {
      const tx = getTx.get(order.id);
      return {
        id: `ORD-${order.id}`,
        dbId: order.id,
        userId: order.user_id,
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          address: order.delivery_address,
        },
        items: getItems.all(order.id).map((item) => ({
          id: item.product_id,
          name: item.product_name,
          price: item.unit_price,
          quantity: item.quantity,
          image: item.image_url || "",
        })),
        total: order.total,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        createdAt: toUtcIso(order.created_at),
        mpesa: tx
          ? {
              checkoutRequestId: tx.checkout_request_id,
              merchantRequestId: tx.merchant_request_id,
              receipt: tx.mpesa_receipt_number,
              resultCode: tx.result_code,
              resultDesc: tx.result_description,
              txStatus: tx.status,
              phone: tx.phone_number,
              amount: tx.amount,
              createdAt: toUtcIso(tx.created_at),
              updatedAt: toUtcIso(tx.updated_at),
            }
          : null,
      };
    });

    return res.json({ success: true, orders: result });
  } catch (error) {
    console.error("Admin order retrieval failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load orders." });
  }
});

app.patch("/api/admin/orders/:id/status", authenticateToken, authorizeAdmin, (req, res) => {
  const orderId = Number(req.params.id);
  const { status } = req.body || {};
  const allowedStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid order status." });
  }

  try {
    const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    return res.json({
      success: true,
      message: "Order status updated.",
      orderId: `ORD-${orderId}`,
      status,
    });
  } catch (error) {
    console.error("Admin order update failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update order status." });
  }
});

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});