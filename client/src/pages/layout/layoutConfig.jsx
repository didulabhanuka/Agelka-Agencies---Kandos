// layoutConfig.jsx
import React from 'react';

import UserDashboard from '@/pages/user/user/UserDashboard';
import SaleRepsDashboard from '@/pages/user/sale-rep/SaleRepsDashboard';
import CustomersDashboard from '@/pages/user/customer/CustomersDashboard';
import SuppliersDashboard from '@/pages/user/supplier/SuppliersDashboard';

import BrandsDashboard from '@/pages/inventorySettings/product-brands/BrandsDashboard';
import GroupsDashboard from '@/pages/inventorySettings/product-groups/GroupsDashboard';
import ProductsDashboard from '@/pages/inventory/products/ProductsDashboard';

import GRNDashboard from '@/pages/purchases/grn/GRNDashboard';
import BranchesDashboard from '@/pages/inventorySettings/branch/BranchDashboard';

import SalesReturnDashboard from '@/pages/sales/sales-return/SalesReturnDashboard';
import SalesInvoiceDashboard from '@/pages/sales/sales-invoice/SalesInvoiceDashboard';

import CustomerPaymentsDashboard from '../finance/CustomerPaymentsDashboard';

import DashboardWrapper from '@/pages/dashboard/DashboardWrapper';

import StockAdjustmentDashboard from '@/pages/inventory/stock-adjustment/StockAdjustmentDashboard';

// --------------------------------------------
// ENCODED KEY MAPPING (C2)
// --------------------------------------------
export const KEY_MAP = {
  "business-dashboard": "dash",
  "inventory": "inv",
  "purchases": "pur",
  "sales": "sal",
  "users": "usr",
  "inventory-settings": "iset",
  "settings": "set",

  "products": "prd",
  "stock-adjustment": "adj",

  "grn": "grn",

  "sales-orders": "sor",
  "sales-returns": "ret",
  
  "finance": "fnc",

  "add-representative": "rep",
  "add-customer": "cus",
  "add-supplier": "sup",
  "add-user": "acc",

  "branches": "brn",
  "brands": "brd",
  "product-groups": "grp",
  "product-types": "typ",
  "unitconfig": "unit",
};

// --------------------------------------------
// NAV ITEMS — FULL ACCESS FOR NOW
// --------------------------------------------

export const navItems = [
  {
    type: 'tab',
    key: 'business-dashboard',
    label: 'Dashboard',
    icon: 'bi bi-columns-gap',
    rolesAllowed: ["Admin", "DataEntry", "SalesRep"],
    component: DashboardWrapper,
  },
  {
    type: 'dropdown',
    key: 'inventory',
    label: 'Inventory',
    icon: 'bi bi-box-seam-fill',
    rolesAllowed: ["Admin", "DataEntry", "SalesRep"],
    subtabs: [
      { key: 'products', label: 'Products', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: ProductsDashboard },
      { key: 'stock-adjustment', label: 'Stock Adjustment', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: StockAdjustmentDashboard },
    ],
  },
  {
    type: 'dropdown',
    key: 'purchases',
    label: 'Purchases',
    icon: 'bi bi-cart-check-fill',
    rolesAllowed: ["Admin", "DataEntry", "SalesRep"],
    subtabs: [
      { key: 'grn', label: 'Good Receive Notes', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: GRNDashboard },
    ],
  },
  {
    type: 'dropdown',
    key: 'sales',
    label: 'Sales',
    icon: 'bi bi-cash-stack',
    rolesAllowed: ["Admin", "DataEntry", "SalesRep"],
    subtabs: [
      { key: 'sales-orders', label: 'Sales Invoices', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: SalesInvoiceDashboard },
      { key: 'sales-returns', label: 'Sales Returns', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: SalesReturnDashboard },
    ],
  },
  {
    type: 'dropdown',
    key: 'finance',
    label: 'finance',
    icon: 'bi bi-cash-coin',
    rolesAllowed: ["Admin", "DataEntry", "SalesRep"],
    subtabs: [
      { key: 'finance', label: 'Manage Finance', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: CustomerPaymentsDashboard },
    ],
  },
  {
    type: 'dropdown',
    key: 'users',
    label: 'Users',
    icon: 'bi bi-people-fill',
    rolesAllowed: ["Admin", "DataEntry", "SalesRep"],
    subtabs: [
      { key: 'add-representative', label: 'Representatives', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: SaleRepsDashboard },
      { key: 'add-customer', label: 'Customers', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: CustomersDashboard },
      { key: 'add-supplier', label: 'Suppliers', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: SuppliersDashboard },
      { key: 'add-user', label: 'Users', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: UserDashboard },
    ],
  },
  {
    type: 'dropdown',
    key: 'inventory-settings',
    label: 'Inventory Settings',
    icon: 'bi bi-toggles',
    rolesAllowed: ["Admin", "DataEntry", "SalesRep"],
    subtabs: [
      { key: 'branches', label: 'Branches', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: BranchesDashboard },
      { key: 'brands', label: 'Brands', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: BrandsDashboard },
      { key: 'product-groups', label: 'Product Groups', rolesAllowed: ["Admin", "DataEntry", "SalesRep"], component: GroupsDashboard },
    ],
  },
  {
    type: 'tab',
    key: 'settings',
    label: 'Settings',
    rolesAllowed: ["Admin", "DataEntry", "SalesRep"],
    component: () => (
      <>
        <h2>Settings</h2>
        <p>Manage your settings here.</p>
      </>
    ),
  },
];

// --------------------------------------------
// Helper maps (unchanged)
// --------------------------------------------

export const dropdownKeys = navItems
  .filter((item) => item.type === 'dropdown')
  .map((item) => item.key);

export const tabComponentMap = {};
export const subTabParentMap = {};
export const subTabComponentMap = {};

navItems.forEach((item) => {
  if (item.type === 'tab') {
    tabComponentMap[item.key] = item.component;
  }
  if (item.type === 'dropdown') {
    item.subtabs.forEach((sub) => {
      subTabParentMap[sub.key] = item.key;
      subTabComponentMap[sub.key] = sub.component;
    });
  }
});
