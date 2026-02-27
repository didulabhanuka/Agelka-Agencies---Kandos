// src/lib/api/finance.api.js
import api from "./axios";

// Customer payments
export const createCustomerPayment = async (payload) =>
  (await api.post("/finance/customer-payments", payload)).data;

export const listCustomerPayments = async (params = {}) =>
  (await api.get("/finance/customer-payments", { params })).data;

export const getCustomerPayment = async (id) =>
  (await api.get(`/finance/customer-payments/${id}`)).data;

export const deleteCustomerPayment = async (id) =>
  (await api.delete(`/finance/customer-payments/${id}`)).data;

export const getCustomerOutstanding = async (customerId) =>
  (await api.get(`/finance/customers/${customerId}/outstanding`)).data;

export const getCustomerOpenInvoices = async (customerId) =>
  (await api.get(`/finance/customers/${customerId}/open-invoices`)).data;

export const previewCustomerPaymentAllocation = async (payload) =>
  (await api.post("/finance/customer-payments/preview", payload)).data;

export const getPaymentsForInvoice = async (invoiceId) =>
  (await api.get(`/finance/customer-payments/by-invoice/${invoiceId}`)).data;

export const updateCustomerPayment = async (id, payload) =>
  (await api.put(`/finance/customer-payments/update/${id}`, payload)).data;

export const approveCustomerPayment = async (id) =>
  (await api.patch(`/finance/customer-payments/approve/${id}`)).data;

// Receivables report
export const getReceivablesReport = async (params = {}) =>
  (await api.get("/finance/customer-payments/reports/receivables", { params }))
    .data;