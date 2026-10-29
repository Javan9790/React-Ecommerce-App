/*import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const API = "http://localhost:5000";

// Format a UTC timestamp as Nairobi time (EAT, UTC+3).
// DB stores UTC — this is the only place we convert for display.
function formatEAT(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const cancelledRef = useRef(false);

  async function fetchOrders({ silent = false } = {}) {
    const token = localStorage.getItem("authToken");
    if (!token) {
      if (!cancelledRef.current) {
        setError("Please log in to view your orders.");
        setLoading(false);
      }
      return;
    }
    if (!silent && !cancelledRef.current) setLoading(true);

    try {
      const response = await fetch(`${API}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load your orders.");
      }
      if (!cancelledRef.current) {
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setError("");
      }
    } catch (err) {
      if (!cancelledRef.current && !silent) {
        setError(err.message || "Unable to load your orders.");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    (async () => {
      await fetchOrders();
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    const hasPending = orders.some(
      (o) =>
        o.paymentMethod === "M-Pesa" &&
        (o.paymentStatus === "Unpaid" || o.paymentStatus === "Pending"),
    );
    if (!hasPending) return;

    const startedAt = Date.now();
    const MAX_MS = 120_000;

    const interval = setInterval(() => {
      if (Date.now() - startedAt > MAX_MS) {
        clearInterval(interval);
        return;
      }
      fetchOrders({ silent: true });
    }, 3000);

    return () => clearInterval(interval);
  }, [orders]);

  if (loading && orders.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <p>Loading your orders...</p>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <p role="alert">{error}</p>
          <Link to="/" className="btn btn-primary">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">My Orders</h1>

        {location.state?.mpesaPaid && (
          <p
            className="order-success"
            role="status"
            style={{
              background: "#ecfdf5",
              border: "1px solid #10b981",
              color: "#065f46",
            }}
          >
            ✅ Payment received
            {location.state.receipt && (
              <>
                {" "}
                — M-Pesa receipt <strong>{location.state.receipt}</strong>
              </>
            )}
            . Your order is confirmed!
          </p>
        )}

        {!location.state?.mpesaPaid && location.state?.newOrderId && (
          <p className="order-success" role="status">
            Order placed successfully! Your order number is{" "}
            <strong>{location.state.newOrderId}</strong>.
          </p>
        )}

        {orders.length === 0 ? (
          <div className="empty-state">
            <h2>No orders yet</h2>
            <p>Your orders will appear here after checkout.</p>
            <Link to="/" className="btn btn-primary">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const isPendingPayment =
                order.paymentMethod === "M-Pesa" &&
                (order.paymentStatus === "Unpaid" ||
                  order.paymentStatus === "Pending");

              const ps = order.paymentStatus;
              const payColor =
                ps === "Paid"
                  ? "#10b981"
                  : ps === "Failed" || ps === "Cancelled"
                    ? "#ef4444"
                    : "#f59e0b";

              // When payment is done but fulfillment hasn't started, say so.
              const statusLabel =
                ps === "Paid" && order.status === "Pending"
                  ? "Paid — awaiting fulfillment"
                  : order.status;

              // Optional paid timestamp — only shown if backend returns it.
              const paidAt =
                order.paidAt || order.mpesa?.paidAt || order.mpesa?.updatedAt;

              return (
                <article className="order-card" key={order.id}>
                  <div className="order-header">
                    <div>
                      <h2>{order.id}</h2>
                      <p>{formatEAT(order.createdAt)}</p>
                      {paidAt && (
                        <p style={{ color: "#6b7280", fontSize: 13 }}>
                          Paid: {formatEAT(paidAt)}
                        </p>
                      )}
                    </div>
                    <span className="order-status">{statusLabel}</span>
                  </div>

                  <p>
                    <strong>Customer:</strong> {order.customer.name}
                  </p>
                  <p>
                    <strong>Delivery address:</strong> {order.customer.address}
                  </p>
                  <p>
                    <strong>Payment method:</strong>{" "}
                    {order.paymentMethod || "Not specified"}
                  </p>
                  <p>
                    <strong>Payment status:</strong>{" "}
                    <span style={{ color: payColor, fontWeight: 600 }}>
                      {ps}
                    </span>
                    {isPendingPayment && (
                      <span
                        style={{
                          marginLeft: 8,
                          color: "#6b7280",
                          fontSize: 13,
                        }}
                      >
                        (waiting for M-Pesa confirmation…)
                      </span>
                    )}
                  </p>

                  {order.mpesa?.receipt && (
                    <p>
                      <strong>M-Pesa Receipt:</strong>{" "}
                      <span style={{ color: "#10b981", fontWeight: 600 }}>
                        {order.mpesa.receipt}
                      </span>
                    </p>
                  )}

                  {order.mpesa?.resultDesc && !order.mpesa?.receipt && (
                    <p style={{ color: "#ef4444", fontSize: 13 }}>
                      <strong>M-Pesa note:</strong> {order.mpesa.resultDesc}
                    </p>
                  )}

                  <h3>Items</h3>
                  {order.items.map((item) => (
                    <div className="order-product" key={item.id}>
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>KES {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}

                  <div className="order-total">
                    Total: KES {Number(order.total).toFixed(2)}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {error && orders.length > 0 && (
          <p role="alert" style={{ marginTop: 16, color: "#ef4444" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}*/

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const API = "http://localhost:5000";

function formatEAT(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const cancelledRef = useRef(false);

  async function fetchOrders({ silent = false } = {}) {
    const token = localStorage.getItem("authToken");
    if (!token) {
      if (!cancelledRef.current) {
        setError("Please log in to view your orders.");
        setLoading(false);
      }
      return;
    }
    if (!silent && !cancelledRef.current) setLoading(true);

    try {
      const response = await fetch(`${API}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load your orders.");
      }
      if (!cancelledRef.current) {
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setError("");
      }
    } catch (err) {
      if (!cancelledRef.current && !silent) {
        setError(err.message || "Unable to load your orders.");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    (async () => {
      await fetchOrders();
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    const hasPending = orders.some(
      (o) =>
        o.paymentMethod === "M-Pesa" &&
        (o.paymentStatus === "Unpaid" || o.paymentStatus === "Pending"),
    );
    if (!hasPending) return;

    const startedAt = Date.now();
    const MAX_MS = 120_000;

    const interval = setInterval(() => {
      if (Date.now() - startedAt > MAX_MS) {
        clearInterval(interval);
        return;
      }
      fetchOrders({ silent: true });
    }, 3000);

    return () => clearInterval(interval);
  }, [orders]);

  if (loading && orders.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <p>Loading your orders…</p>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <h3>Unable to load orders</h3>
            <p>{error}</p>
            <Link to="/" className="btn btn-primary">
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">My Orders</h1>

        {location.state?.mpesaPaid && (
          <p className="order-success" role="status">
            Payment received
            {location.state.receipt && (
              <>
                {" "}
                — M-Pesa receipt <strong>{location.state.receipt}</strong>
              </>
            )}
            . Your order is confirmed.
          </p>
        )}

        {!location.state?.mpesaPaid && location.state?.newOrderId && (
          <p className="order-success" role="status">
            Order placed successfully. Order number:{" "}
            <strong>{location.state.newOrderId}</strong>.
          </p>
        )}

        {orders.length === 0 ? (
          <div className="empty-state">
            <h3>No orders yet</h3>
            <p>Your orders will appear here after checkout.</p>
            <Link to="/" className="btn btn-primary">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const isPendingPayment =
                order.paymentMethod === "M-Pesa" &&
                (order.paymentStatus === "Unpaid" ||
                  order.paymentStatus === "Pending");

              const ps = order.paymentStatus;
              const payColor =
                ps === "Paid"
                  ? "var(--success)"
                  : ps === "Failed" || ps === "Cancelled"
                    ? "var(--danger)"
                    : "var(--warning)";

              const statusLabel =
                ps === "Paid" && order.status === "Pending"
                  ? "Paid — awaiting fulfillment"
                  : order.status;

              const paidAt =
                order.paidAt || order.mpesa?.paidAt || order.mpesa?.updatedAt;

              return (
                <article className="order-card" key={order.id}>
                  <div className="order-header">
                    <div>
                      <h2>{order.id}</h2>
                      <p>{formatEAT(order.createdAt)}</p>
                      {paidAt && (
                        <p style={{ color: "var(--text-soft)", fontSize: 12 }}>
                          Paid: {formatEAT(paidAt)}
                        </p>
                      )}
                    </div>
                    <span className="order-status">{statusLabel}</span>
                  </div>

                  <p>
                    <strong>Customer:</strong> {order.customer.name}
                  </p>
                  <p>
                    <strong>Delivery address:</strong> {order.customer.address}
                  </p>
                  <p>
                    <strong>Payment method:</strong>{" "}
                    {order.paymentMethod || "Not specified"}
                  </p>
                  <p>
                    <strong>Payment status:</strong>{" "}
                    <span style={{ color: payColor, fontWeight: 600 }}>
                      {ps}
                    </span>
                    {isPendingPayment && (
                      <span
                        style={{
                          marginLeft: 8,
                          color: "var(--text-muted)",
                          fontSize: 13,
                        }}
                      >
                        (waiting for M-Pesa confirmation…)
                      </span>
                    )}
                  </p>

                  {order.mpesa?.receipt && (
                    <p>
                      <strong>M-Pesa receipt:</strong>{" "}
                      <span
                        style={{ color: "var(--success)", fontWeight: 600 }}
                      >
                        {order.mpesa.receipt}
                      </span>
                    </p>
                  )}

                  {order.mpesa?.resultDesc && !order.mpesa?.receipt && (
                    <p style={{ color: "var(--danger)", fontSize: 13 }}>
                      <strong>M-Pesa note:</strong> {order.mpesa.resultDesc}
                    </p>
                  )}

                  <h3>Items</h3>
                  {order.items.map((item) => (
                    <div className="order-product" key={item.id}>
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>KES {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}

                  <div className="order-total">
                    Total: KES {Number(order.total).toFixed(2)}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {error && orders.length > 0 && (
          <p role="alert" style={{ marginTop: 16, color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
