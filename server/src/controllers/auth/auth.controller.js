// controllers/auth/auth.controller.js
const { ApiError } = require("../../middlewares/error");
const User = require("../../models/user/user.model");
const SalesRep = require("../../models/user/salesRep.model");

const authService = require("../../services/auth/auth.service");

const {
  signAccessTokenForUser,
  signRefreshTokenForUser,
  signAccessTokenForSalesRep,
  signRefreshTokenForSalesRep,
  verifyRefreshToken,
} = require("../../utils/jwtUtils");

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "rt";
const isProd = process.env.NODE_ENV === "production";

// Refresh token cookie settings (HTTP-only, secure in production, refresh path only, 30-day expiry).
const refreshCookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict",
  path: "/api/auth/refresh",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

// POST /api/auth/login - Unified login endpoint for internal users and sales reps.
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) throw new ApiError(400, "Username and password required");

    // Try internal user authentication first (Admin / DataEntry).
    const user = await authService.loginUser({ username, password });
    if (user) {
      const accessToken = signAccessTokenForUser(user);
      const refreshToken = signRefreshTokenForUser(user);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOpts);

      return res.json({
        accessToken,
        user: {
          id: user._id,
          name: user.username,
          email: user.email ?? null,
          role: user.role, // Admin | DataEntry
          actorType: "User",
        },
      });
    }

    // Fallback to sales rep authentication (username is treated as repCode).
    const rep = await authService.loginSalesRep({ repCode: username, password });
    if (rep) {
      const accessToken = signAccessTokenForSalesRep(rep);
      const refreshToken = signRefreshTokenForSalesRep(rep);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOpts);

      return res.json({
        accessToken,
        user: {
          id: rep._id,
          name: rep.name,
          repCode: rep.repCode,
          role: "SalesRep",
          actorType: "SalesRep",
        },
      });
    }

    throw new ApiError(400, "Invalid credentials");
  } catch (e) {
    next(e);
  }
};

// POST /api/auth/refresh - Validates refresh cookie and rotates tokens.
exports.refresh = async (req, res, next) => {
  try {
    const rt = req.cookies[REFRESH_COOKIE_NAME];
    if (!rt) throw new ApiError(401, "No refresh token");

    // Decode and validate refresh token payload.
    const decoded = verifyRefreshToken(rt);

    // Refresh flow for internal users.
    if (decoded.actorType === "User") {
      const user = await User.findById(decoded.userId).lean();
      if (!user || !user.active) throw new ApiError(403, "Account disabled");

      const accessToken = signAccessTokenForUser(user);
      const newRefresh = signRefreshTokenForUser(user);

      res.cookie(REFRESH_COOKIE_NAME, newRefresh, refreshCookieOpts);

      return res.json({
        accessToken,
        user: { id: user._id, name: user.username, role: user.role, actorType: "User" },
      });
    }

    // Refresh flow for sales reps.
    if (decoded.actorType === "SalesRep") {
      const rep = await SalesRep.findById(decoded.salesRepId).lean();
      if (!rep || rep.status !== "active") throw new ApiError(403, "Account disabled");

      const accessToken = signAccessTokenForSalesRep(rep);
      const newRefresh = signRefreshTokenForSalesRep(rep);

      res.cookie(REFRESH_COOKIE_NAME, newRefresh, refreshCookieOpts);

      return res.json({
        accessToken,
        user: { id: rep._id, name: rep.name, role: "SalesRep", actorType: "SalesRep" },
      });
    }

    throw new ApiError(401, "Invalid refresh token");
  } catch {
    next(new ApiError(401, "Invalid or expired refresh token"));
  }
};

// POST /api/auth/logout - Clears refresh token cookie.
exports.logout = async (_req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOpts, maxAge: 0 });
  res.json({ ok: true });
};