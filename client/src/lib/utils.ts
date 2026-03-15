import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Works locally (relative /api/) AND after deploy (__PORT_5000__ replaced with proxy path)
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function apiRequest(method: string, url: string, body?: any) {
  return fetch(apiUrl(url), {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }
    return res;
  });
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
