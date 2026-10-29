/*import { ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cartCount } = useCart(); // single source of truth, numeric

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          ShopHub
        </Link>
        <div className="navbar-links">
          <Link to="/" className="navbar-link">
            Home
          </Link>
          <Link to="/checkout" className="navbar-cart">
            <ShoppingCart size={22} strokeWidth={2} />

            <span>Cart</span>

            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>

          <Link to="/orders" className="navbar-link">
            My Orders
          </Link>

          {user?.role === "admin" && (
            <Link to="/admin" className="navbar-link">
              Admin
            </Link>
          )}
        </div>
        <div className="navbar-auth">
          {!user ? (
            <div className="navbar-auth-links">
              <Link to="/auth" className="btn btn-secondary">
                Login
              </Link>
              <Link to="/auth" className="btn btn-primary">
                Signup
              </Link>
            </div>
          ) : (
            <div className="navbar-user">
              <span className="navbar-greeting">Hello, {user.email}</span>
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}*/

import { ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          ShopHub
        </Link>

        <div className="navbar-links">
          <Link to="/" className="navbar-link">
            Home
          </Link>
          <Link to="/checkout" className="navbar-cart">
            <ShoppingCart size={18} strokeWidth={2} />
            <span>Cart</span>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
          <Link to="/orders" className="navbar-link">
            My Orders
          </Link>
          {user?.role === "admin" && (
            <Link to="/admin" className="navbar-link">
              Admin
            </Link>
          )}
        </div>

        <div className="navbar-auth">
          {!user ? (
            <div className="navbar-auth-links">
              <Link to="/auth" className="btn btn-secondary">
                Login
              </Link>
              <Link to="/auth" className="btn btn-primary">
                Signup
              </Link>
            </div>
          ) : (
            <div className="navbar-user">
              <span className="navbar-greeting">{user.email}</span>
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
