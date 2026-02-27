// middlewares/auth/auth.middleware.js
const { ApiError } = require("../error");
const { verifyAccessToken } = require("../../utils/jwtUtils");
const User = require("../../models/user/user.model");
const SalesRep = require("../../models/user/salesRep.model");

// Verifies access token from Authorization header (Bearer) or fallback cookie and attaches decoded payload to req.user.
async function verifyJWT(req, _res, next) {
  const header = req.headers.authorization || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;

  // Allow cookie-based access token fallback when Authorization header is not present.
  const cookieToken = req.cookies?.accessToken || null;

  const token = bearerToken || cookieToken;
  if (!token) return next(new ApiError(401, "Unauthorized"));

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded?.actorType) return next(new ApiError(401, "Invalid token payload"));
    req.user = decoded;
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

// Enforces role-based access for internal users and SalesRep actors, while hydrating req.authActor context.
function requireRole(...roleNames) {
  return async (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Unauthorized"));

    try {
      if (req.user.actorType === "User") {
        const user = await User.findById(req.user.userId).lean();
        if (!user || !user.active) return next(new ApiError(403, "Account disabled"));
        if (!roleNames.includes(user.role)) return next(new ApiError(403, "Forbidden"));

        req.authUser = user;
        req.authActor = { actorType: "User", id: user._id, role: user.role };
        return next();
      }

      if (req.user.actorType === "SalesRep") {
        const rep = await SalesRep.findById(req.user.salesRepId).lean();
        if (!rep) return next(new ApiError(403, "Account disabled"));
        if (rep.status && rep.status !== "active") return next(new ApiError(403, "Account disabled"));

        if (!roleNames.includes("SalesRep")) return next(new ApiError(403, "Forbidden"));

        req.authSalesRep = rep;
        req.authActor = { actorType: "SalesRep", id: rep._id, role: "SalesRep" };
        return next();
      }

      return next(new ApiError(401, "Invalid token payload"));
    } catch (e) {
      next(e);
    }
  };
}

// Applies a reusable scope filter for SalesRep-owned resources while leaving User actors unscoped.
function scopeBySalesRep(fieldName = "salesRep") {
  return (req, _res, next) => {
    if (req.authActor?.actorType === "User") {
      req.scopeFilter = {};
      return next();
    }
    if (req.authActor?.actorType === "SalesRep") {
      req.scopeFilter = { [fieldName]: req.authActor.id };
      return next();
    }
    req.scopeFilter = { _id: null };
    next();
  };
}

// Convenience alias for verifyJWT when route semantics prefer requireAuth naming.
function requireAuth(req, res, next) {
  return verifyJWT(req, res, next);
}

module.exports = { verifyJWT, requireRole, scopeBySalesRep, requireAuth };