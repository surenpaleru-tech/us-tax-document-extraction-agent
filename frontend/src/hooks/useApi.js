import { useMemo } from "react";

export function useApi(baseUrl, notify) {
  return useMemo(() => {
    async function request(path, options = {}) {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, options);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      const contentType = response.headers.get("content-type") || "";
      return contentType.includes("application/json") ? response.json() : response.text();
    }

    return {
      get: (path) => request(path),
      post: (path, body) =>
        request(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body || {}),
        }),
      upload: (files) => {
        const form = new FormData();
        Array.from(files).forEach((file) => form.append("files", file));
        return request("/api/upload", { method: "POST", body: form });
      },
      guarded: async (fn, fallback) => {
        try {
          return await fn();
        } catch (error) {
          notify(error.message || "Request failed", "error");
          return fallback;
        }
      },
    };
  }, [baseUrl, notify]);
}
