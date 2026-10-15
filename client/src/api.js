/**
 * KEYCROVE API CLIENT
 * --------------------------------------------------
 * Central communication layer between the frontend
 * and the KeyCrove backend.
 *
 * Features:
 * - Configurable backend URL
 * - JSON request and response handling
 * - Cookie-based session authentication
 * - Consistent error handling
 * - Support for FormData and binary request bodies
 * - No authentication tokens stored in localStorage
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"
).replace(/\/+$/, "");

/**
 * Standardized API error.
 */
export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Extract a useful message from the backend response.
 *
 * Supports responses such as:
 * { message: "Something went wrong" }
 *
 * And:
 * {
 *   error: {
 *     message: "Please log in to continue."
 *   }
 * }
 */
function getErrorMessage(responseData, status) {
  if (
    responseData &&
    typeof responseData === "object"
  ) {
    if (
      responseData.error &&
      typeof responseData.error.message === "string"
    ) {
      return responseData.error.message;
    }

    if (typeof responseData.message === "string") {
      return responseData.message;
    }
  }

  const fallbackMessages = {
    400: "Please check the information you entered.",
    401: "Please log in to continue.",
    403: "You do not have permission to perform this action.",
    404: "The requested resource could not be found.",
    409: "This request conflicts with existing information.",
    413: "The submitted information is too large.",
    429: "Too many requests. Please wait and try again.",
    500: "A server error occurred. Please try again later.",
    502: "The service is temporarily unavailable.",
    503: "The service is temporarily unavailable.",
  };

  return (
    fallbackMessages[status] ||
    `The request failed with status ${status}.`
  );
}

/**
 * Send a request to the KeyCrove backend.
 */
export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    signal,
    ...fetchOptions
  } = options;

  if (typeof path !== "string" || !path.trim()) {
    throw new TypeError(
      "An API endpoint must be provided."
    );
  }

  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const url = `${API_BASE_URL}${normalizedPath}`;

  const requestHeaders = new Headers(headers);

  let requestBody;

  if (body !== undefined && body !== null) {
    const isFormData =
      typeof FormData !== "undefined" &&
      body instanceof FormData;

    const isBlob =
      typeof Blob !== "undefined" &&
      body instanceof Blob;

    const isArrayBuffer =
      typeof ArrayBuffer !== "undefined" &&
      body instanceof ArrayBuffer;

    if (isFormData || isBlob || isArrayBuffer) {
      requestBody = body;
    } else if (typeof body === "string") {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);

      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set(
          "Content-Type",
          "application/json"
        );
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

      // Required for cookie-based login sessions,
      // including supported cross-origin deployments.
      credentials: "include",
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      "Unable to reach KeyCrove. Check your connection and try again."
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

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
    throw new ApiError(
      getErrorMessage(responseData, response.status),
      response.status,
      responseData
    );
  }

  return responseData;
}

/**
 * GET request.
 */
export function apiGet(path, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "GET",
  });
}

/**
 * POST request.
 */
export function apiPost(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "POST",
    body,
  });
}

/**
 * PUT request.
 */
export function apiPut(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "PUT",
    body,
  });
}

/**
 * PATCH request.
 */
export function apiPatch(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "PATCH",
    body,
  });
}

/**
 * DELETE request.
 */
export function apiDelete(path, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "DELETE",
  });
}

/**
 * Convenient default API object.
 */
const api = {
  request: apiRequest,
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
};

export default api;
