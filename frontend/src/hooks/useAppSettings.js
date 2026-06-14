import { useEffect, useState } from "react";
import { DEFAULT_BACKEND } from "../lib/constants";

export function useAppSettings() {
  const [backendUrl, setBackendUrl] = useState(
    () => localStorage.getItem("taxdxBackend") || DEFAULT_BACKEND
  );
  const [reviewer, setReviewer] = useState(
    () => localStorage.getItem("taxdxReviewer") || "enterprise_reviewer"
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem("taxdxTheme") || "system"
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("taxdxSidebarCollapsed") === "true"
  );

  useEffect(() => {
    localStorage.setItem("taxdxBackend", backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    localStorage.setItem("taxdxReviewer", reviewer);
  }, [reviewer]);

  useEffect(() => {
    localStorage.setItem("taxdxTheme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("taxdxSidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return {
    backendUrl,
    setBackendUrl,
    reviewer,
    setReviewer,
    theme,
    setTheme,
    sidebarCollapsed,
    setSidebarCollapsed,
  };
}
