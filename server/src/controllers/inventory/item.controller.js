const { asyncHandler } = require("../../utils/asyncHandler");
const { ApiError } = require("../../middlewares/error");
const { logAction } = require("../../services/audit/audit.service");
const svc = require("../../services/inventory/item.service");

const actor = (req) => ({
  actorType: req.authActor?.actorType,
  actorId: req.authActor?.id,
});

const auditUserId = (req) => req.authActor?.id || req.user?.userId || null;

// -------------------- Create --------------------
exports.create = asyncHandler(async (req, res) => {
  const doc = await svc.createItem(req.body);

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

// -------------------- List --------------------
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

// -------------------- Get by ID --------------------
exports.get = asyncHandler(async (req, res) => {
  const { salesRep } = req.query;
  const doc = await svc.getItem(req.params.id, actor(req), { salesRep });

  if (!doc) throw new ApiError(404, "Item not found");
  res.json(doc);
});

// -------------------- Update --------------------
exports.update = asyncHandler(async (req, res) => {
  const doc = await svc.updateItem(req.params.id, req.body);
  if (!doc) throw new ApiError(404, "Item not found");

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

// -------------------- Delete --------------------
exports.remove = asyncHandler(async (req, res) => {
  const doc = await svc.removeItem(req.params.id);
  if (!doc) throw new ApiError(404, "Item not found");

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

// -------------------- Get items by supplier --------------------
exports.getBySupplier = asyncHandler(async (req, res) => {
  const { salesRep } = req.query;
  const data = await svc.getItemsBySupplier(req.params.supplierId, actor(req), { salesRep });
  res.json(data);
});




