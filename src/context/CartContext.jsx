import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { fetchProducts } from "../api";

const CartContext = createContext(null);

export default function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cartItems") || "[]");
    } catch {
      return [];
    }
  });

  const [products, setProducts] = useState([]);

  // Load products from the backend database.
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const data = await fetchProducts();

        if (!cancelled) {
          setProducts(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Cart product loading error:", error);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  // Save the cart whenever it changes.
  useEffect(() => {
    localStorage.setItem("cartItems", JSON.stringify(cartItems));
  }, [cartItems]);

  // Total item count (sum of quantities) — single source of truth for the badge.
  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cartItems],
  );

  function addToCart(productId) {
    const id = Number(productId);

    setCartItems((currentItems) => {
      const existing = currentItems.find((item) => Number(item.id) === id);

      if (existing) {
        return currentItems.map((item) =>
          Number(item.id) === id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...currentItems, { id, quantity: 1 }];
    });
  }

  // Match saved cart IDs to products loaded from the API.
  function getCartItemsWithProducts() {
    return cartItems
      .map((item) => ({
        ...item,
        product: products.find(
          (product) => Number(product.id) === Number(item.id),
        ),
      }))
      .filter((item) => item.product);
  }

  function removeFromCart(productId) {
    setCartItems((items) =>
      items.filter((item) => Number(item.id) !== Number(productId)),
    );
  }

  function updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems((items) =>
      items.map((item) =>
        Number(item.id) === Number(productId) ? { ...item, quantity } : item,
      ),
    );
  }

  function getCartTotal() {
    return getCartItemsWithProducts().reduce(
      (total, item) => total + Number(item.product.price) * item.quantity,
      0,
    );
  }

  // Clear cart synchronously in localStorage BEFORE the state update so any
  // consumer (or remount) that reads localStorage during the route transition
  // sees an empty cart, not the stale "1".
  const clearCart = useCallback(() => {
    try {
      localStorage.setItem("cartItems", "[]");
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
    setCartItems([]);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount, // <- use this in the navbar badge
        addToCart,
        getCartItemsWithProducts,
        removeFromCart,
        updateQuantity,
        getCartTotal,
        clearCart,
        products,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  return useContext(CartContext);
}
