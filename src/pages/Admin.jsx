/*import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

const emptyProduct = {
  name: "",
  category: "Accessories",
  price: "",
  stock: "0",
  image: "",
  description: "",
};

const orderStatuses = [
  "Pending",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

function normalizeProduct(product) {
  return {
    ...product,
    image: product.image_url || product.image || "",
    stock: Number(product.stock ?? 0),
  };
}

export default function Admin() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadOrders(silent = false) {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const ordersResponse = await fetch(`${API_URL}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ordersData = await ordersResponse.json();
      if (!ordersResponse.ok || !ordersData.success) {
        if (!silent) {
          throw new Error(ordersData.message || "Unable to load orders.");
        }
        return;
      }
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
    } catch (err) {
      if (!silent) setPageError(err.message || "Unable to load orders.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setPageError("Please log in with an administrator account.");
        setLoading(false);
        return;
      }
      try {
        const [productsResponse, ordersResponse] = await Promise.all([
          fetch(`${API_URL}/api/products`),
          fetch(`${API_URL}/api/admin/orders`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const productsData = await productsResponse.json();
        const ordersData = await ordersResponse.json();

        if (!productsResponse.ok) {
          throw new Error(productsData.message || "Unable to load products.");
        }
        if (!ordersResponse.ok || !ordersData.success) {
          throw new Error(ordersData.message || "Unable to load orders.");
        }
        const productList = Array.isArray(productsData)
          ? productsData
          : productsData.products;
        if (!Array.isArray(productList)) {
          throw new Error("Product API returned an unexpected response.");
        }
        if (!cancelled) {
          setProducts(productList.map(normalizeProduct));
          setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
          setPageError("");
        }
      } catch (error) {
        if (!cancelled)
          setPageError(error.message || "Unable to load the dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live refresh orders every 5s to show M-Pesa updates instantly
  useEffect(() => {
    const iv = setInterval(() => {
      loadOrders(true);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    setMessage("");
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (
      !form.name.trim() ||
      !form.category.trim() ||
      form.price === "" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      form.stock === "" ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setMessage(
        "Enter a product name, category, valid price, and whole-number stock.",
      );
      return;
    }
    const token = localStorage.getItem("authToken");
    if (!token) {
      setMessage("Please log in again.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      price,
      stock,
      image_url: form.image.trim(),
      description: form.description.trim(),
    };
    const isEditing = editingId !== null;
    const url = isEditing
      ? `${API_URL}/api/products/${editingId}`
      : `${API_URL}/api/products`;
    try {
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.product) {
        throw new Error(data.message || "Could not save the product.");
      }
      const savedProduct = normalizeProduct(data.product);
      if (isEditing) {
        setProducts((c) =>
          c.map((p) => (p.id === editingId ? savedProduct : p)),
        );
      } else {
        setProducts((c) => [...c, savedProduct]);
      }
      setForm(emptyProduct);
      setEditingId(null);
      setMessage(
        isEditing
          ? "Product updated successfully."
          : "Product added successfully.",
      );
    } catch (error) {
      setMessage(error.message || "Could not save the product.");
    }
  }

  function editProduct(product) {
    setForm({
      name: product.name || "",
      category: product.category || "Accessories",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? 0),
      image: product.image || product.image_url || "",
      description: product.description || "",
    });
    setEditingId(product.id);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id) {
    if (!window.confirm("Delete this product?")) return;
    const token = localStorage.getItem("authToken");
    if (!token) {
      setMessage("Please log in again.");
      return;
    }
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not delete the product.");
      }
      setProducts((c) => c.filter((p) => p.id !== id));
      if (editingId === id) {
        setForm(emptyProduct);
        setEditingId(null);
      }
      setMessage("Product deleted successfully.");
    } catch (error) {
      setMessage(error.message || "Could not delete the product.");
    }
  }

  async function updateOrderStatus(orderDbId, status) {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setMessage("Please log in again.");
      return;
    }
    setMessage("");
    try {
      const response = await fetch(
        `${API_URL}/api/admin/orders/${orderDbId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update the order.");
      }
      setOrders((c) =>
        c.map((o) => (o.dbId === orderDbId ? { ...o, status } : o)),
      );
      setMessage(`Order ${data.orderId} updated to ${status}.`);
    } catch (error) {
      setMessage(error.message || "Could not update the order.");
    }
  }

  const pendingOrders = orders.filter((o) => o.status === "Pending").length;
  const totalSales = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  if (loading) {
    return (
      <main className="page">
        <div className="container admin-container">
          <h1 className="page-title">Admin Dashboard</h1>
          <p>Loading products and customer orders...</p>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="page">
        <div className="container admin-container">
          <h1 className="page-title">Admin Dashboard</h1>
          <p role="alert">{pageError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container admin-container">
        <h1 className="page-title">Admin Dashboard</h1>
        <p>Manage your store&apos;s products and customer orders.</p>

        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div className="admin-stats">
          <div className="admin-stat">
            <span>Products</span>
            <strong>{products.length}</strong>
          </div>
          <div className="admin-stat">
            <span>Total Orders</span>
            <strong>{orders.length}</strong>
          </div>
          <div className="admin-stat">
            <span>Pending Orders</span>
            <strong>{pendingOrders}</strong>
          </div>
          <div className="admin-stat">
            <span>Order Value</span>
            <strong>KES {totalSales.toFixed(2)}</strong>
          </div>
        </div>

        <section className="admin-section">
          <h2>{editingId === null ? "Add Product" : "Edit Product"}</h2>
          <form className="admin-form" onSubmit={handleProductSubmit}>
            <label>
              Product Name
              <input
                className="form-input"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Category
              <input
                className="form-input"
                name="category"
                value={form.category}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Price (KES)
              <input
                className="form-input"
                type="number"
                name="price"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Stock Quantity
              <input
                className="form-input"
                type="number"
                name="stock"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Image URL
              <input
                className="form-input"
                type="url"
                name="image"
                value={form.image}
                onChange={handleChange}
                placeholder="https://example.com/product.jpg"
              />
            </label>
            <label>
              Description
              <textarea
                className="form-input"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
              />
            </label>
            <div className="admin-actions">
              <button className="btn btn-primary" type="submit">
                {editingId === null ? "Add Product" : "Save Changes"}
              </button>
              {editingId !== null && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setForm(emptyProduct);
                    setEditingId(null);
                    setMessage("");
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="admin-section">
          <h2>Product Management</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category || "Uncategorized"}</td>
                    <td>KES {Number(product.price).toFixed(2)}</td>
                    <td>{product.stock}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => editProduct(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => deleteProduct(product.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5}>No products available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2>Customer Orders</h2>
          {orders.length === 0 ? (
            <p>No orders have been placed yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>M-Pesa Receipt</th>
                    <th>Status</th>
                    <th>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const ps = order.paymentStatus;
                    const payColor =
                      ps === "Paid"
                        ? "#10b981"
                        : ps === "Failed" || ps === "Cancelled"
                          ? "#ef4444"
                          : "#f59e0b";
                    return (
                      <tr key={order.dbId}>
                        <td>{order.id}</td>
                        <td>
                          {order.customer?.name || "Customer"}
                          {order.customer?.email && (
                            <>
                              <br />
                              <small>{order.customer.email}</small>
                            </>
                          )}
                        </td>
                        <td>KES {Number(order.total || 0).toFixed(2)}</td>
                        <td>
                          <div>
                            <strong>{order.paymentMethod}</strong>
                          </div>
                          <div style={{ color: payColor, fontSize: 13 }}>
                            {ps}
                          </div>
                          {order.mpesa?.resultDesc && !order.mpesa?.receipt && (
                            <div style={{ color: "#6b7280", fontSize: 12 }}>
                              {order.mpesa.resultDesc}
                            </div>
                          )}
                        </td>
                        <td>
                          {order.mpesa?.receipt ? (
                            <span style={{ color: "#10b981", fontWeight: 600 }}>
                              {order.mpesa.receipt}
                            </span>
                          ) : (
                            <span style={{ color: "#9ca3af", fontSize: 12 }}>
                              {order.mpesa?.txStatus || "—"}
                            </span>
                          )}
                        </td>
                        <td>{order.status}</td>
                        <td>
                          <select
                            className="form-input"
                            value={order.status || "Pending"}
                            onChange={(e) =>
                              updateOrderStatus(order.dbId, e.target.value)
                            }
                            aria-label={`Status for order ${order.id}`}
                          >
                            {orderStatuses.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}*/

import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

const emptyProduct = {
  name: "",
  category: "Accessories",
  price: "",
  stock: "0",
  image: "",
  description: "",
};

const orderStatuses = [
  "Pending",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

function normalizeProduct(product) {
  return {
    ...product,
    image: product.image_url || product.image || "",
    stock: Number(product.stock ?? 0),
  };
}

export default function Admin() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadOrders(silent = false) {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const ordersResponse = await fetch(`${API_URL}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ordersData = await ordersResponse.json();
      if (!ordersResponse.ok || !ordersData.success) {
        if (!silent) {
          throw new Error(ordersData.message || "Unable to load orders.");
        }
        return;
      }
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
    } catch (err) {
      if (!silent) setPageError(err.message || "Unable to load orders.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setPageError("Please log in with an administrator account.");
        setLoading(false);
        return;
      }
      try {
        const [productsResponse, ordersResponse] = await Promise.all([
          fetch(`${API_URL}/api/products`),
          fetch(`${API_URL}/api/admin/orders`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const productsData = await productsResponse.json();
        const ordersData = await ordersResponse.json();

        if (!productsResponse.ok) {
          throw new Error(productsData.message || "Unable to load products.");
        }
        if (!ordersResponse.ok || !ordersData.success) {
          throw new Error(ordersData.message || "Unable to load orders.");
        }
        const productList = Array.isArray(productsData)
          ? productsData
          : productsData.products;
        if (!Array.isArray(productList)) {
          throw new Error("Product API returned an unexpected response.");
        }
        if (!cancelled) {
          setProducts(productList.map(normalizeProduct));
          setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
          setPageError("");
        }
      } catch (error) {
        if (!cancelled)
          setPageError(error.message || "Unable to load the dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      loadOrders(true);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    setMessage("");
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (
      !form.name.trim() ||
      !form.category.trim() ||
      form.price === "" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      form.stock === "" ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setMessage(
        "Enter a product name, category, valid price, and whole-number stock.",
      );
      return;
    }
    const token = localStorage.getItem("authToken");
    if (!token) {
      setMessage("Please log in again.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      price,
      stock,
      image_url: form.image.trim(),
      description: form.description.trim(),
    };
    const isEditing = editingId !== null;
    const url = isEditing
      ? `${API_URL}/api/products/${editingId}`
      : `${API_URL}/api/products`;
    try {
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.product) {
        throw new Error(data.message || "Could not save the product.");
      }
      const savedProduct = normalizeProduct(data.product);
      if (isEditing) {
        setProducts((c) =>
          c.map((p) => (p.id === editingId ? savedProduct : p)),
        );
      } else {
        setProducts((c) => [...c, savedProduct]);
      }
      setForm(emptyProduct);
      setEditingId(null);
      setMessage(
        isEditing
          ? "Product updated successfully."
          : "Product added successfully.",
      );
    } catch (error) {
      setMessage(error.message || "Could not save the product.");
    }
  }

  function editProduct(product) {
    setForm({
      name: product.name || "",
      category: product.category || "Accessories",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? 0),
      image: product.image || product.image_url || "",
      description: product.description || "",
    });
    setEditingId(product.id);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id) {
    if (!window.confirm("Delete this product?")) return;
    const token = localStorage.getItem("authToken");
    if (!token) {
      setMessage("Please log in again.");
      return;
    }
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not delete the product.");
      }
      setProducts((c) => c.filter((p) => p.id !== id));
      if (editingId === id) {
        setForm(emptyProduct);
        setEditingId(null);
      }
      setMessage("Product deleted successfully.");
    } catch (error) {
      setMessage(error.message || "Could not delete the product.");
    }
  }

  async function updateOrderStatus(orderDbId, status) {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setMessage("Please log in again.");
      return;
    }
    setMessage("");
    try {
      const response = await fetch(
        `${API_URL}/api/admin/orders/${orderDbId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update the order.");
      }
      setOrders((c) =>
        c.map((o) => (o.dbId === orderDbId ? { ...o, status } : o)),
      );
      setMessage(`Order ${data.orderId} updated to ${status}.`);
    } catch (error) {
      setMessage(error.message || "Could not update the order.");
    }
  }

  const pendingOrders = orders.filter((o) => o.status === "Pending").length;
  const totalSales = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  if (loading) {
    return (
      <main className="page">
        <div className="container admin-container">
          <h1 className="page-title">Admin Dashboard</h1>
          <p>Loading dashboard…</p>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="page">
        <div className="container admin-container">
          <h1 className="page-title">Admin Dashboard</h1>
          <p role="alert">{pageError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container admin-container">
        <h1 className="page-title">Admin Dashboard</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.925rem" }}>
          Manage your store&apos;s products and customer orders.
        </p>

        {message && (
          <p
            role="status"
            aria-live="polite"
            style={{ marginTop: 12, color: "var(--text-muted)" }}
          >
            {message}
          </p>
        )}

        <div className="admin-stats">
          <div className="admin-stat">
            <span>Products</span>
            <strong>{products.length}</strong>
          </div>
          <div className="admin-stat">
            <span>Total Orders</span>
            <strong>{orders.length}</strong>
          </div>
          <div className="admin-stat">
            <span>Pending Orders</span>
            <strong>{pendingOrders}</strong>
          </div>
          <div className="admin-stat">
            <span>Order Value</span>
            <strong>KES {totalSales.toFixed(2)}</strong>
          </div>
        </div>

        <section className="admin-section">
          <h2>{editingId === null ? "Add Product" : "Edit Product"}</h2>
          <form className="admin-form" onSubmit={handleProductSubmit}>
            <label>
              Product Name
              <input
                className="form-input"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Category
              <input
                className="form-input"
                name="category"
                value={form.category}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Price (KES)
              <input
                className="form-input"
                type="number"
                name="price"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Stock Quantity
              <input
                className="form-input"
                type="number"
                name="stock"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              Image URL
              <input
                className="form-input"
                type="url"
                name="image"
                value={form.image}
                onChange={handleChange}
                placeholder="https://example.com/product.jpg"
              />
            </label>
            <label>
              Description
              <textarea
                className="form-input"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
              />
            </label>
            <div className="admin-actions">
              <button className="btn btn-primary" type="submit">
                {editingId === null ? "Add Product" : "Save Changes"}
              </button>
              {editingId !== null && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setForm(emptyProduct);
                    setEditingId(null);
                    setMessage("");
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="admin-section">
          <h2>Product Management</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category || "Uncategorized"}</td>
                    <td>KES {Number(product.price).toFixed(2)}</td>
                    <td>{product.stock}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="btn btn-secondary btn-small"
                          type="button"
                          onClick={() => editProduct(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          type="button"
                          onClick={() => deleteProduct(product.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5}>No products available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2>Customer Orders</h2>
          {orders.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>
              No orders have been placed yet.
            </p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>M-Pesa Receipt</th>
                    <th>Status</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const ps = order.paymentStatus;
                    const payColor =
                      ps === "Paid"
                        ? "var(--success)"
                        : ps === "Failed" || ps === "Cancelled"
                          ? "var(--danger)"
                          : "var(--warning)";
                    return (
                      <tr key={order.dbId}>
                        <td>{order.id}</td>
                        <td>
                          {order.customer?.name || "Customer"}
                          {order.customer?.email && (
                            <>
                              <br />
                              <small>{order.customer.email}</small>
                            </>
                          )}
                        </td>
                        <td>KES {Number(order.total || 0).toFixed(2)}</td>
                        <td>
                          <div>
                            <strong>{order.paymentMethod}</strong>
                          </div>
                          <div style={{ color: payColor, fontSize: 13 }}>
                            {ps}
                          </div>
                          {order.mpesa?.resultDesc && !order.mpesa?.receipt && (
                            <div
                              style={{
                                color: "var(--text-soft)",
                                fontSize: 12,
                              }}
                            >
                              {order.mpesa.resultDesc}
                            </div>
                          )}
                        </td>
                        <td>
                          {order.mpesa?.receipt ? (
                            <span
                              style={{
                                color: "var(--success)",
                                fontWeight: 600,
                              }}
                            >
                              {order.mpesa.receipt}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "var(--text-soft)",
                                fontSize: 12,
                              }}
                            >
                              {order.mpesa?.txStatus || "—"}
                            </span>
                          )}
                        </td>
                        <td>{order.status}</td>
                        <td>
                          <select
                            className="form-input"
                            value={order.status || "Pending"}
                            onChange={(e) =>
                              updateOrderStatus(order.dbId, e.target.value)
                            }
                            aria-label={`Status for order ${order.id}`}
                          >
                            {orderStatuses.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}