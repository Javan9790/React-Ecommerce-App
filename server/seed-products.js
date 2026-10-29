
import db from "./db.js";
import { products } from "../src/data/products.js";

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products
    (id, name, description, price, category, image_url, stock)
  VALUES
    (@id, @name, @description, @price, @category, @image, @stock)
`);

const seedProducts = db.transaction((items) => {
  for (const product of items) {
    insertProduct.run({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      image: product.image,
      stock: 10,
    });
  }
});

try {
  seedProducts(products);

  const result = db
    .prepare("SELECT COUNT(*) AS count FROM products")
    .get();

  console.log(`Database contains ${result.count} products.`);
} finally {
  db.close();
}