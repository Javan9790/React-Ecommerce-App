
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

const databasePath = fileURLToPath(
  new URL("./shop.db", import.meta.url)
);

const db = new Database(databasePath, {
  readonly: true,
  fileMustExist: true,
});

try {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    )
    .all();

  console.log("Tables:", tables.map((table) => table.name));


const productColumns = db
  .prepare("PRAGMA table_info(products)")
  .all();

console.log(
  "Products columns:",
  productColumns.map((column) => column.name)
);

const productCount = db
  .prepare("SELECT COUNT(*) AS count FROM products")
  .get();

console.log("Product records:", productCount.count);

  const orders = db
    .prepare(`
      SELECT id, user_id, total, status, payment_status, created_at
      FROM orders
      ORDER BY id DESC
      LIMIT 5
    `)
    .all();

  console.log("Latest orders:", orders);


const items = db
  .prepare(`
    SELECT
      order_id,
      product_id,
      product_name,
      unit_price,
      quantity
    FROM order_items
    WHERE order_id = ?
  `)
  .all(orders[0].id);

console.log("Latest order items:", items);

const calculatedTotal = items.reduce(
  (sum, item) => sum + item.unit_price * item.quantity,
  0
);

console.log(
  "Calculated item total:",
  Math.round(calculatedTotal * 100) / 100
);

const userRoles = db
  .prepare("SELECT id, role FROM users")
  .all();

console.log("User roles:", userRoles);


} finally {
  db.close();
}