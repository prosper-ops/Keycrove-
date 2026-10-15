/**
 * KEYCROVE AUTHENTICATION MIDDLEWARE
 *
 * This file protects private API endpoints.
 *
 * It checks the server-side login session before allowing
 * a request to access protected resources.
 *
 * IMPORTANT:
 * This middleware depends on express-session being
 * configured in server/src/server.js.
 */

/**
 * Require an authenticated user.
 *
 * If the user is not logged in, return HTTP 401.
 * Otherwise, continue to the requested route.
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

  return next();
}

/**
 * Attach the authenticated user's ID to req.user.
 *
 * This middleware must run after requireAuth.
 *
 * The user ID comes from the server-side session,
 * not from a user ID supplied in the request body.
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

  return next();
}

/**
 * Alternative name for the authentication middleware.
 *
 * This allows routes to use either:
 *
 * requireAuth
 *
 * or:
 *
 * requireAuthenticatedUser
 */
export const requireAuthenticatedUser = requireAuth;
