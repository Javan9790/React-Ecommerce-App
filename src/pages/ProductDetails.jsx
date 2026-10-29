/*import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProductById } from "../api";
import { useCart } from "../context/CartContext";

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cartItems } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchProductById(id);

        if (!cancelled) {
          setProduct(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Unable to load this product.");
        }
        console.error("Product details error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <h1>Loading product...</h1>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page">
        <div className="container empty-state">
          <h2>{error || "Product not found."}</h2>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  const productInCart = cartItems.find((item) => item.id === product.id);

  const productQuantityLabel = productInCart
    ? `(${productInCart.quantity})`
    : "";

  return (
    <div className="page">
      <div className="container">
        <div className="product-detail">
          <div className="product-detail-image">
            <img src={product.image} alt={product.name} />
          </div>

          <div className="product-detail-content">
            <h1 className="product-detail-name">{product.name}</h1>

            <p className="product-detail-price">{product.priceLabel}</p>

            <p className="product-detail-description">{product.description}</p>

            <button
              className="btn btn-primary"
              onClick={() => addToCart(product.id)}
            >
              Add to Cart {productQuantityLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}*/

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProductById } from "../api";
import { useCart } from "../context/CartContext";

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cartItems } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchProductById(id);
        if (!cancelled) setProduct(data);
      } catch (err) {
        if (!cancelled) setError("Unable to load this product.");
        console.error("Product details error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <p>Loading product…</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page">
        <div className="container empty-state">
          <h3>{error || "Product not found."}</h3>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  const productInCart = cartItems.find((item) => item.id === product.id);
  const productQuantityLabel = productInCart
    ? `(${productInCart.quantity})`
    : "";

  return (
    <div className="page">
      <div className="container">
        <div className="product-detail">
          <div className="product-detail-image">
            <img src={product.image} alt={product.name} />
          </div>

          <div className="product-detail-content">
            <h1 className="product-detail-name">{product.name}</h1>
            <p className="product-detail-price">{product.priceLabel}</p>
            <p className="product-detail-description">{product.description}</p>
            <button
              className="btn btn-primary btn-large"
              onClick={() => addToCart(product.id)}
            >
              Add to Cart {productQuantityLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
