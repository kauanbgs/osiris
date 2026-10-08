import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("osiris_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("osiris_token");

      if (!token) {
        setUser(null);
        localStorage.removeItem("osiris_user");
        setLoading(false);
        return;
      }

      try {
        const response = await auth.getUser();
        const userData = response.data?.user || response.data;
        if (userData) {
          setUser(userData);
          localStorage.setItem("osiris_user", JSON.stringify(userData));
        }
      } catch (error) {
        console.error("Erro ao carregar sessão do usuário:", error);
        if (error.response?.status === 401) {
          localStorage.removeItem("osiris_token");
          localStorage.removeItem("osiris_user");
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function login(email, password) {
    const response = await auth.login(email, password);

    const { token, user: userData } = response.data;

    localStorage.setItem("osiris_token", token);
    if (userData) {
      localStorage.setItem("osiris_user", JSON.stringify(userData));
      setUser(userData);
    }

    return userData;
  }

  async function register(name, email, password) {
    const response = await auth.register(name, email, password);

    return response.data;
  }

  function logout() {
    localStorage.removeItem("osiris_token");
    localStorage.removeItem("osiris_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}