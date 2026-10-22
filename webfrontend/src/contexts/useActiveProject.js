import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function activeProjectKey(owner) {
  return "osiris_active_project:" + JSON.stringify(String(owner));
}

export function useActiveProject() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const owner = user?.id_user ?? user?.id ?? user?.email;
  const match = pathname.match(/^\/(?:home|workflow)\/([^/]+)$/);
  const routeId = match ? decodeURIComponent(match[1]) : null;
  const key = owner ? activeProjectKey(owner) : null;
  const activeId = routeId || (key ? localStorage.getItem(key) : null);

  useEffect(() => {
    if (key && routeId) localStorage.setItem(key, routeId);
  }, [key, routeId]);

  return { owner, activeId };
}
