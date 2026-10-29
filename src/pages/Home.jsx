/*import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../api";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const data = await fetchProducts();

        if (!cancelled) {
          setProducts(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            "Could not load products. Please check that the backend is running.",
          );
        }
        console.error("Product loading error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = [
    "All",
    ...new Set(products.map((product) => product.category)),
  ];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesCategory = category === "All" || product.category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="page">
      <div className="home-hero">
        <h1 className="home-title">Welcome to ShopHub</h1>
        <p className="home-subtitle">
          Discover amazing products at great prices
        </p>
      </div>

      <div className="container">
        <h2 className="page-title">Our Products</h2>

        {loading ? (
          <p>Loading products...</p>
        ) : error ? (
          <div className="empty-state">
            <h3>Unable to load products</h3>
            <p>{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="product-filters">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
              />

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-input"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <p className="product-count">
              Showing {filteredProducts.length} product
              {filteredProducts.length !== 1 ? "s" : ""}
            </p>

            {filteredProducts.length > 0 ? (
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No products found</h3>
                <p>Try another search or category.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}*/

import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../api";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProducts();
        if (!cancelled) setProducts(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            "Could not load products. Please check that the backend is running.",
          );
        }
        console.error("Product loading error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = [
    "All",
    ...new Set(products.map((product) => product.category)),
  ];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory = category === "All" || product.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="page">
      <div className="home-hero">
        <h1 className="home-title">Welcome to ShopHub</h1>
        <p className="home-subtitle">
          Curated products, delivered to your door.
        </p>
      </div>

      <div className="container">
        <h2 className="page-title">Our Products</h2>

        {loading ? (
          <p>Loading products…</p>
        ) : error ? (
          <div className="empty-state">
            <h3>Unable to load products</h3>
            <p>{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="product-filters">
              <input
                type="text"
                placeholder="Search products…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-input"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <p className="product-count">
              Showing {filteredProducts.length} product
              {filteredProducts.length !== 1 ? "s" : ""}
            </p>

            {filteredProducts.length > 0 ? (
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No products found</h3>
                <p>Try another search or category.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
