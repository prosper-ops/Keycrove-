/**
 * KeyCrove authentication middleware.
 *
 * This middleware protects private API routes by checking
 * whether the request has an authenticated server-side session.
 *
 * It depends on express-session being configured in server.js.
 */

export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Please log in to continue.",
      },
    });
  }

  next();
}

/**
 * Attach the authenticated user's ID to the request.
 *
 * Route handlers can use req.user.id to identify the current user.
 * The ID comes from the server-side session, not from a client-
 * supplied user ID.
 *
 * This middleware must run after requireAuth.
 */
export function attachCurrentUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Please log in to continue.",
      },
    });
  }

  req.user = {
    id: req.session.userId,
  };

  next();
}

/**
 * Reject requests when the session is missing or has expired.
 *
 * This alias makes route definitions easier to read.
 */
export const requireAuthenticatedUser = requireAuth;
