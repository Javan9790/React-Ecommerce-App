import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Checkout from "./pages/Checkout";
import Navbar from "./components/Navbar";
import Admin from "./pages/Admin";
import "./App.css";
import AuthProvider from "./context/AuthContext";
import ProductDetails from "./pages/ProductDetails";
import CartProvider from "./context/CartContext";
import Orders from "./pages/Orders";

import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";


function AdminRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}


function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="app">
          <Navbar />

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/products/:id" element={<ProductDetails />} />
            <Route path="/orders" element={<Orders />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
