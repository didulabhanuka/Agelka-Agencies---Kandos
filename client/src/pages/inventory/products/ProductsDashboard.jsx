// src/pages/products/ProductsDashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";

import { getBrands, getProductGroups } from "../../../lib/api/settings.api";
import { deleteItem, getItems } from "../../../lib/api/inventory.api";
import { getSuppliers } from "../../../lib/api/users.api";

import ProductModal from "./ProductModal";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const ProductsDashboard = () => {
  // Data state
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // UI state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [groupFilter, setGroupFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");

  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedItem, setSelectedItem] = useState(null);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Fetch all master data + items
  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);

    try {
      const [itemRes, brandRes, groupRes, supplierRes] = await Promise.all([
        getItems(),
        getBrands(),
        getProductGroups(),
        getSuppliers?.() ?? Promise.resolve([]),
      ]);

      setItems(itemRes || []);
      setBrands((brandRes || []).filter((b) => b.status === "active"));
      setGroups((groupRes || []).filter((g) => g.status === "active"));
      setSuppliers((supplierRes || []).filter((s) => s.status === "active"));
    } catch (err) {
      console.error("Failed to load products:", err);
      toast.error("Failed to load products or master data");
    } finally {
      setLoading(false);
    }
  };

  // Resolve display labels from either populated object or id
  const resolveLabel = (list, value, fields) => {
    if (!value) return "-";

    if (typeof value === "object") {
      for (const f of fields) if (value?.[f]) return value[f];
      return "-";
    }

    const found = list.find((x) => x._id === value);
    if (!found) return "-";

    for (const f of fields) if (found?.[f]) return found[f];
    return "-";
  };

  const getBrandLabel = (it) => resolveLabel(brands, it.brand, ["brandCode", "name"]);

  const getStockStatusMeta = (status) => {
    switch (status) {
      case "in_stock":
        return { label: "In Stock", icon: "bi-check-circle-fill", className: "pill-success" };
      case "low_stock":
        return {
          label: "Low Stock",
          icon: "bi-exclamation-triangle-fill",
          className: "pill-warning",
        };
      case "out_of_stock":
        return { label: "Out of Stock", icon: "bi-x-circle-fill", className: "pill-danger" };
      default:
        return { label: "Unknown", icon: "bi-question-circle-fill", className: "pill-muted" };
    }
  };

  // Extract qty safely (supports qtyOnHand object or simple number)
  const getQtyParts = (it) => {
    const qty = it?.qtyOnHand;

    if (qty && typeof qty === "object") {
      return {
        primary: Number(qty.qtyOnHandPrimary ?? 0),
        base: Number(qty.qtyOnHandBase ?? 0),
      };
    }

    return { primary: Number(qty ?? 0), base: 0 };
  };

  const formatQtyWithUom = (qty, uom) => {
    const n = Number(qty ?? 0);
    if (!uom) return `${n}`;
    return `${n} ${uom}${n !== 1 ? "s" : ""}`;
  };

  // Format price with currency
  const formatPrice = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `Rs. ${new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)}`;
  };

  // Filter + sort items
  const filteredItems = useMemo(() => {
    let data = [...items];

    const s = search.trim().toLowerCase();
    if (s) {
      data = data.filter(
        (it) =>
          it.itemCode?.toLowerCase().includes(s) ||
          it.name?.toLowerCase().includes(s) ||
          it.description?.toLowerCase().includes(s)
      );
    }

    if (statusFilter !== "All") {
      data = data.filter((it) => (it.status || "active") === statusFilter);
    }

    if (brandFilter !== "All") {
      data = data.filter((it) => {
        const val = typeof it.brand === "object" ? it.brand?._id : it.brand;
        return val === brandFilter;
      });
    }

    if (supplierFilter !== "All") {
      data = data.filter((it) => {
        const val = typeof it.supplier === "object" ? it.supplier?._id : it.supplier;
        return val === supplierFilter;
      });
    }

    if (groupFilter !== "All") {
      data = data.filter((it) => {
        const val =
          typeof it.productGroup === "object" ? it.productGroup?._id : it.productGroup;
        return val === groupFilter;
      });
    }

    if (stockFilter !== "All") {
      data = data.filter((it) => (it.stockStatus || "") === stockFilter);
    }

    const stockRank = {
      in_stock: 1,
      low_stock: 2,
      out_of_stock: 3,
      unknown: 4,
    };

    data.sort((a, b) => {
      let aVal;
      let bVal;

      switch (sortConfig.key) {
        case "name":
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
          break;
        case "brand":
          aVal = getBrandLabel(a).toLowerCase();
          bVal = getBrandLabel(b).toLowerCase();
          break;
        case "price":
          aVal = Number(a.sellingPricePrimary ?? -1);
          bVal = Number(b.sellingPricePrimary ?? -1);
          break;
        case "stock":
          aVal = stockRank[a.stockStatus || "unknown"] ?? 99;
          bVal = stockRank[b.stockStatus || "unknown"] ?? 99;
          break;
        default:
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [
    items,
    search,
    statusFilter,
    brandFilter,
    supplierFilter,
    groupFilter,
    stockFilter,
    sortConfig,
    brands,
  ]);

  // Filter dropdown options
  const brandFilterOptions = useMemo(
    () =>
      brands.map((b) => ({
        value: b._id,
        label: `${b.brandCode || ""} — ${b.name}`,
      })),
    [brands]
  );

  // Modal handlers
  const handleOpenModal = async (nextMode, item = null) => {
    try {
      setLoading(true);

      // If later you add getItem(id), call it here before setSelectedItem(...)
      setModalMode(nextMode);
      setSelectedItem(item);
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
  };

  // Delete handler
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;

    try {
      setLoading(true);
      await deleteItem(id);
      toast.success("Product deleted");
      await fetchAll();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete product");
      setLoading(false);
    }
  };

  // Sort handler
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: "asc",
      };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "bi-arrow-down-up";
    return sortConfig.direction === "asc" ? "bi-sort-down" : "bi-sort-up";
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setBrandFilter("All");
    setSupplierFilter("All");
    setGroupFilter("All");
    setStockFilter("All");
    setSortConfig({ key: "name", direction: "asc" });
  };

  const visibleCountLabel = useMemo(() => {
    const count = filteredItems.length;
    return `${count} product${count === 1 ? "" : "s"}`;
  }, [filteredItems.length]);

  return (
    <div className="container-fluid py-4 px-5">
      {/* Local UI polish styles (SalesInvoiceDashboard style) */}
      <style>
        {`
          .products-table-wrap {
            max-height: 72vh;
            overflow: auto;
            border-radius: 14px;
          }

          .products-table-wrap .modern-table thead th {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #fff;
            box-shadow: inset 0 -1px 0 #eef0f3;
            white-space: nowrap;
          }

          .product-row {
            transition: background-color .15s ease, box-shadow .15s ease;
          }

          .product-row:hover {
            background: #fafbff;
            box-shadow: inset 3px 0 0 #5c3e94;
          }

          .sort-btn {
            border: none;
            background: transparent;
            padding: 0;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            color: inherit;
          }

          .sort-btn:hover {
            color: #5c3e94;
          }

          .icon-btn-ux {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            background: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all .15s ease;
          }

          .icon-btn-ux:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(0,0,0,.08);
          }

          .icon-btn-ux.view:hover {
            color: #1d4ed8;
            border-color: #bfdbfe;
            background: #eff6ff;
          }

          .icon-btn-ux.edit:hover {
            color: #7c3aed;
            border-color: #ddd6fe;
            background: #f5f3ff;
          }

          .icon-btn-ux.delete:hover {
            color: #b42318;
            border-color: #fecdca;
            background: #fef3f2;
          }

          .status-pill-ux {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border: 1px solid transparent;
            white-space: nowrap;
          }

          .status-pill-ux.pill-success {
            background: #ecfdf3;
            color: #027a48;
            border-color: #abefc6;
          }

          .status-pill-ux.pill-warning {
            background: #fffaeb;
            color: #b54708;
            border-color: #fedf89;
          }

          .status-pill-ux.pill-danger {
            background: #fef3f2;
            color: #b42318;
            border-color: #fecdca;
          }

          .status-pill-ux.pill-muted {
            background: #f2f4f7;
            color: #475467;
            border-color: #e4e7ec;
          }

          .filter-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
          }

          .filter-grid .filter-input {
            min-width: 220px;
          }

          .filter-grid .custom-select {
            min-width: 160px;
          }

          .result-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            font-size: 12px;
            font-weight: 700;
            color: #475467;
          }

          .table-top-note {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            flex-wrap: wrap;
          }

          .qty-label,
          .price-label {
            min-width: 48px;
            display: inline-block;
            font-size: 12px;
            color: #6b7280;
          }

          .product-name {
            font-weight: 700;
            color: #111827;
          }

          .product-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .avatar-circle {
            width: 34px;
            height: 34px;
            border-radius: 999px;
            background: #f3f4f6;
            color: #374151;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            border: 1px solid #e5e7eb;
            flex-shrink: 0;
          }

          .brand-main {
            font-weight: 600;
            color: #111827;
          }

          .amount-main {
            font-weight: 700;
            color: #111827;
          }

          .amount-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }
        `}
      </style>

      <div className="pb-4">
        <h2 className="page-title">Products</h2>
        <p className="page-subtitle">Manage your item catalogue and stock.</p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-left" style={{ width: "100%" }}>
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search product..."
              className="filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Brand */}
            <select
              className="custom-select"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="All">All Brands</option>
              {brandFilterOptions.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>

            {/* Stock */}
            <select
              className="custom-select"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="All">All Stock Status</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>

            <button
              type="button"
              className="btn btn-light border"
              onClick={resetFilters}
              title="Reset all filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1" />
              Reset
            </button>
          </div>
        </div>

        <button className="action-btn" onClick={() => handleOpenModal("create")}>
          + Add Product
        </button>
      </div>

      {/* Table */}
      <div className="table-container p-3">
        <div className="table-top-note">
          <span className="result-badge">
            <i className="bi bi-box" />
            {visibleCountLabel}
          </span>

          {loading && (
            <span className="small text-muted">
              <i className="bi bi-arrow-repeat me-1" />
              Loading...
            </span>
          )}
        </div>

        <div className="products-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <button className="sort-btn" onClick={() => handleSort("name")}>
                    Product <i className={`bi ${getSortIcon("name")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("brand")}>
                    Brand <i className={`bi ${getSortIcon("brand")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("price")}>
                    Prices <i className={`bi ${getSortIcon("price")}`} />
                  </button>
                </th>

                <th>
                  <button className="sort-btn" onClick={() => handleSort("stock")}>
                    Stock <i className={`bi ${getSortIcon("stock")}`} />
                  </button>
                </th>

                <th>Qty</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.length ? (
                filteredItems.map((it) => {
                  const qty = getQtyParts(it);
                  const stockMeta = getStockStatusMeta(it.stockStatus);

                  return (
                    <tr key={it._id} className="product-row">
                      {/* Product */}
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="avatar-circle">
                            {it.name?.charAt(0)?.toUpperCase() ||
                              it.itemCode?.charAt(0)?.toUpperCase() ||
                              "P"}
                          </div>

                          <div>
                            <div className="product-name">{it.name || "-"}</div>
                            <div className="product-sub">{it.itemCode || "-"}</div>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td>
                        <div className="brand-main">{getBrandLabel(it)}</div>
                      </td>

                      {/* Prices */}
                      <td>
                        <div>
                          <div className="amount-main">{formatPrice(it.sellingPricePrimary)}</div>
                          <div className="amount-sub">
                            Cost: {formatPrice(it.avgCostPrimary)}
                          </div>
                        </div>
                      </td>

                      {/* Stock visual */}
                      <td>
                        <span className={`status-pill-ux ${stockMeta.className}`}>
                          <i className={`bi ${stockMeta.icon}`} />
                          {stockMeta.label}
                        </span>
                      </td>

                      {/* Qty */}
                      <td>
                        <div className="small">
                          <div className="d-flex align-items-center gap-1">
                            <span className="qty-label">Primary:</span>
                            <span className="fw-semibold">
                              {formatQtyWithUom(qty.primary, it.primaryUom)}
                            </span>
                          </div>

                          {it.baseUom ? (
                            <div className="d-flex align-items-center gap-1 mt-1">
                              <span className="qty-label">Base:</span>
                              <span className="text-muted">
                                {formatQtyWithUom(qty.base, it.baseUom)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            className="icon-btn-ux view"
                            title="View"
                            onClick={() => handleOpenModal("view", it)}
                          >
                            <i className="bi bi-eye" />
                          </button>

                          <button
                            className="icon-btn-ux edit"
                            title="Edit"
                            onClick={() => handleOpenModal("edit", it)}
                          >
                            <i className="bi bi-pencil-square" />
                          </button>

                          <button
                            className="icon-btn-ux delete"
                            title="Delete"
                            onClick={() => handleDelete(it._id)}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    {loading ? "Loading products..." : "No products found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <ProductModal
        show={modalOpen}
        mode={modalMode}
        selectedItem={selectedItem}
        onClose={handleCloseModal}
        onSuccess={fetchAll}
        brands={brands}
        groups={groups}
        suppliers={suppliers}
      />

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default ProductsDashboard;