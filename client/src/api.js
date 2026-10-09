/**
 * KeyCrove API Client
 * -------------------
 * Centralized communication between the frontend
 * and the KeyCrove backend.
 *
 * Features:
 * - Configurable backend URL
 * - JSON request and response handling
 * - Cookie-based session support
 * - Consistent error handling
 * - Support for JSON and FormData
 * - No authentication tokens stored in localStorage
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Sends an HTTP request to the KeyCrove backend.
 *
 * @param {string} path - API endpoint, such as "/api/auth/login".
 * @param {object} options - Fetch options and request configuration.
 * @returns {Promise<unknown>} The response returned by the server.
 */

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    signal,
    ...fetchOptions
  } = options;

  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const url = `${API_BASE_URL}${normalizedPath}`;

  const requestHeaders = new Headers(headers);

  let requestBody;

  if (body !== undefined && body !== null) {
    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer
    ) {
      requestBody = body;
    } else if (typeof body === "string") {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);

      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }
    }
  }

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  let response;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      method,
      headers: requestHeaders,
      body: requestBody,
      signal,

      // Allows the browser to send and receive session cookies.
      credentials: "include",
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      "Unable to reach KeyCrove. Check your connection and try again."
    );
  }

  const contentType = response.headers.get("content-type") || "";

  let responseData = null;

  if (response.status !== 204) {
    try {
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const serverMessage =
      responseData &&
      typeof responseData === "object" &&
      typeof responseData.message === "string"
        ? responseData.message
        : null;

    const message =
      serverMessage ||
      `The request failed with status ${response.status}.`;

    throw new ApiError(
      message,
      response.status,
      responseData
    );
  }

  return responseData;
}

/**
 * Sends a GET request.
 */

export function apiGet(path, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "GET",
  });
}

/**
 * Sends a POST request.
 */

export function apiPost(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "POST",
    body,
  });
}

/**
 * Sends a PUT request.
 */

export function apiPut(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "PUT",
    body,
  });
}

/**
 * Sends a PATCH request.
 */

export function apiPatch(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "PATCH",
    body,
  });
}

/**
 * Sends a DELETE request.
 */

export function apiDelete(path, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "DELETE",
  });
}

const api = {
  request: apiRequest,
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
};

export default api;
