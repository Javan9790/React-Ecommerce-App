import { createContext, useState, useContext } from "react";

const AuthContext = createContext(null);
const API_URL = "http://localhost:5000/api";

function getSavedUser() {
  try {
    const token = localStorage.getItem("authToken");
    const savedUser = localStorage.getItem("authUser");

    if (!token || !savedUser) return null;

    return JSON.parse(savedUser);
  } catch {
    return null;
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser);

  async function authenticate(endpoint, payload) {
    try {
      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || "Authentication failed.",
        };
      }

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));
      setUser(data.user);

      return { success: true, user: data.user };
    } catch (error) {
      console.error("Authentication request failed:", error);

      return {
        success: false,
        error: "Cannot connect to the server. Please try again.",
      };
    }
  }

  function signUp(name, email, password) {
    return authenticate("register", { name, email, password });
  }

  function login(email, password) {
    return authenticate("login", { email, password });
  }

  function logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ signUp, user, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
