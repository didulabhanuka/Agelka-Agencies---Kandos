import api from "./axios";

// ----- SALES INVOICES -----
export const createSalesInvoice = async (payload) => (await api.post("/sale/sales-invoice", payload)).data;
export const approveSalesInvoice = async (id) => (await api.patch(`/sale/sales-invoice/${id}/approve`)).data;
export const getSalesInvoice = async (id) => (await api.get(`/sale/sales-invoice/${id}`)).data;
export const updateSalesInvoice = async (id, payload) => (await api.put(`/sale/sales-invoice/${id}`, payload)).data;
export const deleteSalesInvoice = async (id) => (await api.delete(`/sale/sales-invoice/${id}`)).data;
export const listSalesInvoices = async (params) => (await api.get("/sale/sales-invoices", { params })).data;

export const listAvailableSaleItems = async (params) => (await api.get("/sale/sales-invoice/available-items", { params })).data;

// ----- SALES RETURNS -----
export const createSalesReturn = async (payload) => (await api.post("/sale/sales-return", payload)).data;
export const approveSalesReturn = async (id) => (await api.patch(`/sale/sales-return/${id}/approve`)).data;
export const getSalesReturn = async (id) => (await api.get(`/sale/sales-return/${id}`)).data;
export const listSalesReturns = async (params) => (await api.get("/sale/sales-returns", { params })).data;
export const deleteSalesReturn = async (id) => (await api.delete(`/sale/sales-return/${id}`)).data; 
export const updateSalesReturn = async (id, payload) => (await api.put(`/sale/sales-return/${id}`, payload)).data;