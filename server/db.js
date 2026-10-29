import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

const databasePath = fileURLToPath(new URL("./shop.db", import.meta.url));
console.log("ShopHub database path:", databasePath);

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer'
      CHECK (role IN ('customer', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL DEFAULT 'General',
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    total REAL NOT NULL CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'Pending',
    payment_status TEXT NOT NULL DEFAULT 'Unpaid',
    payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    merchant_request_id TEXT,
    checkout_request_id TEXT UNIQUE,
    phone_number TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'Pending'
      CHECK (status IN ('Pending', 'Paid', 'Failed', 'Cancelled')),
    mpesa_receipt_number TEXT,
    result_code TEXT,
    result_description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_order_id
    ON mpesa_transactions(order_id);
  CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status
    ON mpesa_transactions(status);
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✅ Added ${table}.${column}`);
  }
}

ensureColumn("orders", "payment_method", "TEXT NOT NULL DEFAULT 'Cash on Delivery'");
ensureColumn("mpesa_transactions", "merchant_request_id", "TEXT");
ensureColumn("mpesa_transactions", "checkout_request_id", "TEXT");
ensureColumn("mpesa_transactions", "phone_number", "TEXT NOT NULL DEFAULT ''");
ensureColumn("mpesa_transactions", "amount", "REAL NOT NULL DEFAULT 0");
ensureColumn("mpesa_transactions", "status", "TEXT NOT NULL DEFAULT 'Pending'");
ensureColumn("mpesa_transactions", "mpesa_receipt_number", "TEXT");
ensureColumn("mpesa_transactions", "result_code", "TEXT");
ensureColumn("mpesa_transactions", "result_description", "TEXT");
ensureColumn("mpesa_transactions", "created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
ensureColumn("mpesa_transactions", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");

db.exec(`DROP TRIGGER IF EXISTS trg_mpesa_transactions_updated_at;`);

console.log("SQLite database initialized.");
console.log("ShopHub database ready:", databasePath);

export default db;