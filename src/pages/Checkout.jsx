/*import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

const API = "http://localhost:5000";

// Backoff schedule: first check after 1s, then 1s, 2s, 2s, then 3s steady.
const POLL_DELAYS_MS = [1000, 1000, 2000, 2000, 3000];

async function pollPaymentStatus(
  checkoutRequestId,
  token,
  { onPaid, onFailed, onTimeout },
) {
  const startedAt = Date.now();
  const TIMEOUT_MS = 120_000;
  let attempt = 0;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const delay =
      POLL_DELAYS_MS[attempt] ?? POLL_DELAYS_MS[POLL_DELAYS_MS.length - 1];
    attempt++;

    await new Promise((r) => setTimeout(r, delay));

    try {
      const res = await fetch(`${API}/api/mpesa/status/${checkoutRequestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.success) continue;

      if (data.status === "paid") {
        onPaid(data.mpesaReceipt);
        return;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        onFailed(
          data.status === "cancelled"
            ? "You cancelled the M-Pesa prompt. Please try again."
            : data.resultDesc || "Payment failed.",
        );
        return;
      }
    } catch {
      // network blip — keep polling silently
    }
  }
  onTimeout();
}

export default function Checkout() {
  const {
    getCartItemsWithProducts,
    updateQuantity,
    removeFromCart,
    getCartTotal,
    clearCart,
  } = useCart();

  const navigate = useNavigate();
  const cartItems = getCartItemsWithProducts();
  const total = getCartTotal();

  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    address: "",
    paymentMethod: "Cash on Delivery",
  });

  const [mpesaPhone, setMpesaPhone] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentState, setPaymentState] = useState({ stage: "idle" });

  function handleChange(event) {
    setCustomer({ ...customer, [event.target.name]: event.target.value });
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (isSubmitting) return;
    if (cartItems.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Please log in before placing an order.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setPaymentState({ stage: "idle" });

    try {
      const orderRes = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer,
          items: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      let orderData;
      try {
        orderData = await orderRes.json();
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      if (!orderRes.ok || !orderData.success || !orderData.order) {
        throw new Error(orderData.message || "Unable to save your order.");
      }
      const savedOrder = orderData.order;

      // Cash on Delivery → clear cart immediately, go to orders
      if (customer.paymentMethod !== "M-Pesa") {
        clearCart();
        navigate("/orders", { state: { newOrderId: savedOrder.id } });
        return;
      }

      if (!savedOrder.dbId)
        throw new Error("Order saved, but no DB ID returned.");

      const stkRes = await fetch(`${API}/api/mpesa/stkpush`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: savedOrder.dbId,
          phoneNumber: mpesaPhone,
        }),
      });

      let stkData;
      try {
        stkData = await stkRes.json();
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      if (!stkRes.ok || !stkData.success) {
        // STK push never started — leave the cart intact so the user can
        // retry (e.g. fix the phone number) without re-adding items.
        throw new Error(
          stkData.message || "Order saved, but M-Pesa could not be started.",
        );
      }

      // STK prompt accepted by Safaricom — NOW clear the cart. The order is
      // already persisted server-side, so the cart is logically done.
      clearCart();

      setPaymentState({
        stage: "waiting",
        orderId: savedOrder.id,
        checkoutRequestId: stkData.checkoutRequestId,
      });

      await pollPaymentStatus(stkData.checkoutRequestId, token, {
        onPaid: (receipt) => {
          navigate("/orders", {
            replace: true,
            state: { newOrderId: savedOrder.id, mpesaPaid: true, receipt },
          });
        },
        onFailed: (reason) => setPaymentState({ stage: "failed", reason }),
        onTimeout: () => setPaymentState({ stage: "timeout" }),
      });
    } catch (err) {
      console.error("Checkout failed:", err);
      const msg = err.message || "";
      setError(
        msg.includes("Insufficient stock")
          ? "Sorry, not enough stock. Reduce quantity and try again."
          : msg || "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cartItems.length === 0 && paymentState.stage !== "success") {
    return (
      <div className="page">
        <div className="container">
          <h1 className="page-title">Your cart is empty</h1>
          <p>Add products before proceeding to checkout.</p>
          <Link to="/" className="btn btn-primary">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const isWaiting = paymentState.stage === "waiting";
  const isLocked = isSubmitting || isWaiting;

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">Checkout</h1>

        {paymentState.stage === "waiting" && (
          <div
            style={{
              padding: 16,
              marginBottom: 16,
              background: "#eff6ff",
              border: "1px solid #3b82f6",
              borderRadius: 8,
            }}
          >
            <h3>📱 Check your phone</h3>
            <p>
              Enter your M-Pesa PIN to complete payment of KES{" "}
              {Math.ceil(total)}.
            </p>
            <p style={{ color: "#6b7280" }}>Waiting for confirmation…</p>
          </div>
        )}

        {paymentState.stage === "success" && (
          <div
            style={{
              padding: 16,
              marginBottom: 16,
              background: "#ecfdf5",
              border: "1px solid #10b981",
              borderRadius: 8,
            }}
          >
            <h3>✅ Payment received</h3>
            <p>
              Receipt: <strong>{paymentState.receipt}</strong>
            </p>
            <p>Taking you to your orders…</p>
          </div>
        )}

        {paymentState.stage === "failed" && (
          <div
            style={{
              padding: 16,
              marginBottom: 16,
              background: "#fef2f2",
              border: "1px solid #ef4444",
              borderRadius: 8,
            }}
          >
            <h3>❌ Payment failed</h3>
            <p>{paymentState.reason}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPaymentState({ stage: "idle" })}
            >
              Try again
            </button>
          </div>
        )}

        {paymentState.stage === "timeout" && (
          <div
            style={{
              padding: 16,
              marginBottom: 16,
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              borderRadius: 8,
            }}
          >
            <h3>⏱️ Payment timed out</h3>
            <p>
              If you completed payment on your phone, check your orders page in
              a minute. Otherwise try again.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPaymentState({ stage: "idle" })}
            >
              Try again
            </button>
          </div>
        )}

        <div className="checkout-container">
          <form className="checkout-items" onSubmit={placeOrder}>
            <h2 className="checkout-section-title">Delivery Information</h2>

            <label className="form-label" htmlFor="customer-name">
              Full Name
            </label>
            <input
              id="customer-name"
              className="form-input"
              name="name"
              value={customer.name}
              onChange={handleChange}
              required
              disabled={isLocked}
            />

            <label className="form-label" htmlFor="customer-email">
              Email Address
            </label>
            <input
              id="customer-email"
              className="form-input"
              type="email"
              name="email"
              value={customer.email}
              onChange={handleChange}
              required
              disabled={isLocked}
            />

            <label className="form-label" htmlFor="customer-address">
              Delivery Address
            </label>
            <textarea
              id="customer-address"
              className="form-input"
              name="address"
              value={customer.address}
              onChange={handleChange}
              required
              rows={3}
              disabled={isLocked}
            />

            <label className="form-label" htmlFor="payment-method">
              Payment Method
            </label>
            <select
              id="payment-method"
              className="form-input"
              name="paymentMethod"
              value={customer.paymentMethod}
              onChange={handleChange}
              disabled={isLocked}
            >
              <option>Cash on Delivery</option>
              <option>M-Pesa</option>
            </select>

            {customer.paymentMethod === "M-Pesa" && (
              <>
                <label className="form-label" htmlFor="mpesa-phone">
                  M-Pesa Phone Number
                </label>
                <input
                  id="mpesa-phone"
                  className="form-input"
                  type="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  placeholder="0712345678"
                  pattern="(?:\+254|254|0)?[17]\d{8}"
                  title="Enter a valid Kenyan phone number"
                  required
                  disabled={isLocked}
                />
              </>
            )}

            <h2 className="checkout-section-title">Order Summary</h2>

            {cartItems.map((item) => (
              <div className="checkout-item" key={item.id}>
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="checkout-item-image"
                />
                <div className="checkout-item-details">
                  <h3 className="checkout-item-name">{item.product.name}</h3>
                  <p>KES {item.product.price.toFixed(2)} each</p>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={isLocked}
                    >
                      -
                    </button>
                    <span className="quantity-value">{item.quantity}</span>
                    <button
                      type="button"
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={isLocked}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => removeFromCart(item.id)}
                    disabled={isLocked}
                  >
                    Remove
                  </button>
                </div>
                <p className="checkout-item-total">
                  KES {(item.product.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}

            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-large btn-block"
              disabled={isLocked}
            >
              {isWaiting
                ? "Awaiting M-Pesa confirmation…"
                : isSubmitting
                  ? "Processing…"
                  : "Place Order"}
            </button>
          </form>

          <aside className="checkout-summary">
            <h2 className="checkout-section-title">Order Total</h2>
            <div className="checkout-total">
              <p className="checkout-total-label">Subtotal:</p>
              <p className="checkout-total-value">KES {total.toFixed(2)}</p>
            </div>
            <div className="checkout-total">
              <p className="checkout-total-label">Total:</p>
              <p className="checkout-total-value checkout-total-final">
                KES {total.toFixed(2)}
              </p>
            </div>
            <p>
              {customer.paymentMethod === "M-Pesa"
                ? "You will get an STK prompt on your phone to confirm payment."
                : "Pay cash when your order is delivered."}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}*/

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

const API = "http://localhost:5000";

const POLL_DELAYS_MS = [1000, 1000, 2000, 2000, 3000];

async function pollPaymentStatus(
  checkoutRequestId,
  token,
  { onPaid, onFailed, onTimeout },
) {
  const startedAt = Date.now();
  const TIMEOUT_MS = 120_000;
  let attempt = 0;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const delay =
      POLL_DELAYS_MS[attempt] ?? POLL_DELAYS_MS[POLL_DELAYS_MS.length - 1];
    attempt++;
    await new Promise((r) => setTimeout(r, delay));

    try {
      const res = await fetch(`${API}/api/mpesa/status/${checkoutRequestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.success) continue;

      if (data.status === "paid") {
        onPaid(data.mpesaReceipt);
        return;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        onFailed(
          data.status === "cancelled"
            ? "You cancelled the M-Pesa prompt. Please try again."
            : data.resultDesc || "Payment failed.",
        );
        return;
      }
    } catch {
      // network blip — keep polling silently
    }
  }
  onTimeout();
}

function StatusBanner({ tone, title, children }) {
  const tones = {
    info: {
      bg: "#eff6ff",
      border: "#bfdbfe",
      color: "#1e40af",
    },
    success: {
      bg: "var(--success-bg)",
      border: "var(--success-border)",
      color: "#065f46",
    },
    danger: {
      bg: "var(--danger-bg)",
      border: "var(--danger-border)",
      color: "#991b1b",
    },
    warning: {
      bg: "var(--warning-bg)",
      border: "var(--warning-border)",
      color: "#92400e",
    },
  };
  const t = tones[tone];
  return (
    <div
      role="status"
      style={{
        padding: "0.9rem 1.1rem",
        marginBottom: "1.5rem",
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        borderRadius: "var(--radius)",
        fontSize: "0.925rem",
      }}
    >
      {title && <p style={{ fontWeight: 700, marginBottom: 4 }}>{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export default function Checkout() {
  const {
    getCartItemsWithProducts,
    updateQuantity,
    removeFromCart,
    getCartTotal,
    clearCart,
  } = useCart();

  const navigate = useNavigate();
  const cartItems = getCartItemsWithProducts();
  const total = getCartTotal();

  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    address: "",
    paymentMethod: "Cash on Delivery",
  });

  const [mpesaPhone, setMpesaPhone] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentState, setPaymentState] = useState({ stage: "idle" });

  function handleChange(event) {
    setCustomer({ ...customer, [event.target.name]: event.target.value });
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (isSubmitting) return;
    if (cartItems.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Please log in before placing an order.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setPaymentState({ stage: "idle" });

    try {
      const orderRes = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer,
          items: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      let orderData;
      try {
        orderData = await orderRes.json();
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      if (!orderRes.ok || !orderData.success || !orderData.order) {
        throw new Error(orderData.message || "Unable to save your order.");
      }
      const savedOrder = orderData.order;

      if (customer.paymentMethod !== "M-Pesa") {
        clearCart();
        navigate("/orders", { state: { newOrderId: savedOrder.id } });
        return;
      }

      if (!savedOrder.dbId)
        throw new Error("Order saved, but no DB ID returned.");

      const stkRes = await fetch(`${API}/api/mpesa/stkpush`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: savedOrder.dbId,
          phoneNumber: mpesaPhone,
        }),
      });

      let stkData;
      try {
        stkData = await stkRes.json();
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      if (!stkRes.ok || !stkData.success) {
        throw new Error(
          stkData.message || "Order saved, but M-Pesa could not be started.",
        );
      }

      clearCart();

      setPaymentState({
        stage: "waiting",
        orderId: savedOrder.id,
        checkoutRequestId: stkData.checkoutRequestId,
      });

      await pollPaymentStatus(stkData.checkoutRequestId, token, {
        onPaid: (receipt) => {
          navigate("/orders", {
            replace: true,
            state: { newOrderId: savedOrder.id, mpesaPaid: true, receipt },
          });
        },
        onFailed: (reason) => setPaymentState({ stage: "failed", reason }),
        onTimeout: () => setPaymentState({ stage: "timeout" }),
      });
    } catch (err) {
      console.error("Checkout failed:", err);
      const msg = err.message || "";
      setError(
        msg.includes("Insufficient stock")
          ? "Sorry, not enough stock. Reduce quantity and try again."
          : msg || "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cartItems.length === 0 && paymentState.stage !== "success") {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <h3>Your cart is empty</h3>
            <p>Add products before proceeding to checkout.</p>
            <Link to="/" className="btn btn-primary">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isWaiting = paymentState.stage === "waiting";
  const isLocked = isSubmitting || isWaiting;

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">Checkout</h1>

        {paymentState.stage === "waiting" && (
          <StatusBanner tone="info" title="Check your phone">
            Enter your M-Pesa PIN to complete payment of{" "}
            <strong>KES {Math.ceil(total)}</strong>. Waiting for confirmation…
          </StatusBanner>
        )}

        {paymentState.stage === "success" && (
          <StatusBanner tone="success" title="Payment received">
            Receipt: <strong>{paymentState.receipt}</strong>. Taking you to your
            orders…
          </StatusBanner>
        )}

        {paymentState.stage === "failed" && (
          <StatusBanner tone="danger" title="Payment failed">
            {paymentState.reason}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => setPaymentState({ stage: "idle" })}
              >
                Try again
              </button>
            </div>
          </StatusBanner>
        )}

        {paymentState.stage === "timeout" && (
          <StatusBanner tone="warning" title="Payment timed out">
            If you completed payment on your phone, check your orders page in a
            minute. Otherwise try again.
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => setPaymentState({ stage: "idle" })}
              >
                Try again
              </button>
            </div>
          </StatusBanner>
        )}

        <div className="checkout-container">
          <form className="checkout-items" onSubmit={placeOrder}>
            <h2 className="checkout-section-title">Delivery Information</h2>

            <label className="form-label" htmlFor="customer-name">
              Full Name
            </label>
            <input
              id="customer-name"
              className="form-input"
              name="name"
              value={customer.name}
              onChange={handleChange}
              required
              disabled={isLocked}
            />

            <label className="form-label" htmlFor="customer-email">
              Email Address
            </label>
            <input
              id="customer-email"
              className="form-input"
              type="email"
              name="email"
              value={customer.email}
              onChange={handleChange}
              required
              disabled={isLocked}
            />

            <label className="form-label" htmlFor="customer-address">
              Delivery Address
            </label>
            <textarea
              id="customer-address"
              className="form-input"
              name="address"
              value={customer.address}
              onChange={handleChange}
              required
              rows={3}
              disabled={isLocked}
            />

            <label className="form-label" htmlFor="payment-method">
              Payment Method
            </label>
            <select
              id="payment-method"
              className="form-input"
              name="paymentMethod"
              value={customer.paymentMethod}
              onChange={handleChange}
              disabled={isLocked}
            >
              <option>Cash on Delivery</option>
              <option>M-Pesa</option>
            </select>

            {customer.paymentMethod === "M-Pesa" && (
              <>
                <label className="form-label" htmlFor="mpesa-phone">
                  M-Pesa Phone Number
                </label>
                <input
                  id="mpesa-phone"
                  className="form-input"
                  type="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  placeholder="0712345678"
                  pattern="(?:\+254|254|0)?[17]\d{8}"
                  title="Enter a valid Kenyan phone number"
                  required
                  disabled={isLocked}
                />
              </>
            )}

            <h2 className="checkout-section-title">Order Summary</h2>

            {cartItems.map((item) => (
              <div className="checkout-item" key={item.id}>
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="checkout-item-image"
                />
                <div className="checkout-item-details">
                  <h3 className="checkout-item-name">{item.product.name}</h3>
                  <p>KES {item.product.price.toFixed(2)} each</p>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={isLocked}
                    >
                      −
                    </button>
                    <span className="quantity-value">{item.quantity}</span>
                    <button
                      type="button"
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={isLocked}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => removeFromCart(item.id)}
                    disabled={isLocked}
                    style={{ alignSelf: "flex-start" }}
                  >
                    Remove
                  </button>
                </div>
                <p className="checkout-item-total">
                  KES {(item.product.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}

            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-large btn-block"
              disabled={isLocked}
              style={{ marginTop: "1rem" }}
            >
              {isWaiting
                ? "Awaiting M-Pesa confirmation…"
                : isSubmitting
                  ? "Processing…"
                  : "Place Order"}
            </button>
          </form>

          <aside className="checkout-summary">
            <h2 className="checkout-section-title">Order Total</h2>
            <div className="checkout-total">
              <span className="checkout-total-label">Subtotal</span>
              <span className="checkout-total-value">
                KES {total.toFixed(2)}
              </span>
            </div>
            <div className="checkout-total">
              <span className="checkout-total-label">Total</span>
              <span className="checkout-total-value checkout-total-final">
                KES {total.toFixed(2)}
              </span>
            </div>
            <p>
              {customer.paymentMethod === "M-Pesa"
                ? "You will receive an STK prompt on your phone to confirm payment."
                : "Pay cash when your order is delivered."}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
