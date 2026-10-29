
/*const API_URL = "http://localhost:5000/api";

export async function fetchProducts() {
  const response = await fetch(`${API_URL}/products`);

  if (!response.ok) {
    throw new Error("Failed to load products from the server.");
  }

  const data = await response.json();

  // Convert the database field names into the format
  // your existing React components use.
  return data.products.map((product) => ({
    ...product,
    image: product.image_url,
  }));
}

export async function fetchProductById(id) {
  const response = await fetch(
    `${API_URL}/products/${id}`

  );

  if (!response.ok) {
    throw new Error("Failed to load product details.");
  }

  const data = await response.json();

  return {
    ...data.product,
    image: data.product.image_url,
  };
}*/

const API_URL = "http://localhost:5000/api";

export function formatKES(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "Ksh —";
  return `Ksh ${num.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function fetchProducts() {
  const response = await fetch(`${API_URL}/products`);

  if (!response.ok) {
    throw new Error("Failed to load products from the server.");
  }

  const data = await response.json();

  return data.products.map((product) => ({
    ...product,
    image: product.image_url,
    priceLabel: formatKES(product.price),
  }));
}

export async function fetchProductById(id) {
  const response = await fetch(`${API_URL}/products/${id}`);

  if (!response.ok) {
    throw new Error("Failed to load product details.");
  }

  const data = await response.json();

  return {
    ...data.product,
    image: data.product.image_url,
    priceLabel: formatKES(data.product.price),
  };
}