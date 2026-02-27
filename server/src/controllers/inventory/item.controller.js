// controllers/inventory/item.controller.js
const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/inventory/item.service");

// Returns normalized actor context used by item service authorization/scoping.
const actor = (req) => ({
  actorType: req.authActor?.actorType,
  actorId: req.authActor?.id,
});

// Returns legacy actor context from req.user (kept for compatibility where needed).
function getActor(req) {
  const actorType = req.user?.actorType;
  const userId = req.user?.userId || null;
  const salesRepId = req.user?.salesRepId || null;
  return { actorType, userId, salesRepId };
}

// Resolves the actor id used for audit logging across auth payload variants.
const auditUserId = (req) => req.authActor?.id || req.user?.userId || null;

// POST /inventory/items - Creates a new item record.
exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.createItem(req.body);

  // Write audit log for item creation.
  await logAction({
    userId: auditUserId(req),
    action: "master.items.create",
    module: "Masterfile",
    details: { id: doc._id },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.status(201).json(doc);
});

// GET /inventory/items - Lists items with filters, pagination, and actor-based scope.
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, q, status, brand, productGroup, unit, salesRep } = req.query;

  const data = await svc.listItems(
    {
      ...(status ? { status } : {}),
      ...(brand ? { brand } : {}),
      ...(productGroup ? { productGroup } : {}),
      ...(unit ? { unit } : {}),
    },
    { page, limit, q, status, salesRep },
    actor(req)
  );

  res.json(data);
});

// GET /inventory/items/:id - Returns a single item by id with optional salesRep scope.
exports.get = asyncHandler(async (req, res) => {
  const { salesRep } = req.query;
  const doc = await svc.getItem(req.params.id, actor(req), { salesRep });

  if (!doc) throw new ApiError(404, "Item not found");
  res.json(doc);
});

// PUT /inventory/items/:id - Updates an item and records audit log.
exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.updateItem(req.params.id, req.body);
  if (!doc) throw new ApiError(404, "Item not found");

  // Write audit log for item update.
  await logAction({
    userId: auditUserId(req),
    action: "master.items.update",
    module: "Masterfile",
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json(doc);
});

// DELETE /inventory/items/:id - Deletes an item and records audit log.
exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.removeItem(req.params.id);
  if (!doc) throw new ApiError(404, "Item not found");

  // Write audit log for item deletion.
  await logAction({
    userId: auditUserId(req),
    action: "master.items.delete",
    module: "Masterfile",
    details: { id: req.params.id },
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  res.json({ success: true });
});

// GET /inventory/items/by-supplier/:supplierId - Returns items for a supplier with optional salesRep scope.
exports.getBySupplier = asyncHandler(async (req, res) => {
  const { salesRep } = req.query;
  const data = await svc.getItemsBySupplier(req.params.supplierId, actor(req), { salesRep });
  res.json(data);
});

// GET /inventory/items/salesrep-stock-details - Returns sales rep stock detail list (self-scoped for SalesRep actor).
exports.listSalesRepStockDetails = asyncHandler(async (req, res) => {
  const a = actor(req);
  const scope = a.actorType === "SalesRep" ? { salesRep: a.actorId } : {};

  const list = await svc.listSalesRepStockDetails({}, scope);
  res.json(list);
});