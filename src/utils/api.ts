/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction } from "../types";

// Check if localStorage has item to determine access
const CLIENT_STORAGE_KEY = "local_transactions";
const API_KEYS_STORAGE_KEY = "local_api_keys";

export interface LocalApiKeys {
  resendApiKey: string;
  brevoApiKey: string;
}

// Helper to get local API keys
export function getLocalApiKeys(): LocalApiKeys {
  try {
    const data = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading local API keys:", e);
  }
  return { resendApiKey: "", brevoApiKey: "" };
}

// Helper to save local API keys
export function saveLocalApiKeys(keys: LocalApiKeys) {
  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch (e) {
    console.error("Error saving local API keys:", e);
  }
}

/**
 * Safely fetches a URL and parses it as JSON, checking Content-Type first
 * to avoid "Unexpected token 'T'" HTML parsing errors.
 */
export async function safeFetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null; isHtml: boolean; status: number }> {
  try {
    const response = await fetch(url, options);
    const status = response.status;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      return {
        data: null,
        error: `HTML response received. The server may be misconfigured or running in static-only mode.`,
        isHtml: true,
        status,
      };
    }

    const text = await response.text();
    if (!text.trim()) {
      return {
        data: null,
        error: response.ok ? null : `Empty response (Status ${status})`,
        isHtml: false,
        status,
      };
    }
    
    // Check if response is actually JSON before parsing
    if (!contentType.includes("application/json")) {
      return {
        data: null,
        error: `Server returned non-JSON response (Status ${status}): ${text.substring(0, 50)}...`,
        isHtml: false,
        status,
      };
    }

    try {
      const data = JSON.parse(text) as T;
      if (!response.ok) {
        return {
          data,
          error: (data as any)?.error || `Server error (Status ${status})`,
          isHtml: false,
          status,
        };
      }
      return { data, error: null, isHtml: false, status };
    } catch (e) {
      return {
        data: null,
        error: `Failed to parse response as JSON. Content preview: "${text.substring(0, 100)}"`,
        isHtml: contentType.trim().startsWith("<") || text.trim().startsWith("<"),
        status,
      };
    }
  } catch (err: any) {
    return {
      data: null,
      error: err.message || "Network connection failed. Check if server is running.",
      isHtml: false,
      status: 0,
    };
  }
}

/**
 * Fallback Local Storage functions
 */
export function getLocalTransactions(): Transaction[] {
  try {
    const data = localStorage.getItem(CLIENT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse local transactions:", e);
    return [];
  }
}

export function saveLocalTransactions(transactions: Transaction[]) {
  try {
    localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error("Failed to save transactions locally:", e);
  }
}

export function addLocalTransaction(tx: Transaction): Transaction[] {
  const current = getLocalTransactions();
  const existingIndex = current.findIndex((t) => t.id === tx.id);
  if (existingIndex !== -1) {
    current[existingIndex] = tx;
  } else {
    current.unshift(tx);
  }
  saveLocalTransactions(current);
  return current;
}

export function clearLocalTransactions() {
  saveLocalTransactions([]);
}
