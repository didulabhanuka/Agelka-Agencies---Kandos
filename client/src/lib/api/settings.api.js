import api from './axios';

// ----- BRANDS -----
export const getBrands = async (params) => (await api.get('/inventorySettings/brands', { params })).data;
export const createBrand = async (payload) => (await api.post('/inventorySettings/brands', payload)).data;
export const updateBrand = async (id, payload) => (await api.put(`/inventorySettings/brands/${id}`, payload)).data;
export const deleteBrand = async (id) => (await api.delete(`/inventorySettings/brands/${id}`)).data;

// ----- PRODUCT GROUPS -----
export const getProductGroups = async (params) => (await api.get('/inventorySettings/groups', { params })).data;
export const createProductGroup = async (payload) => (await api.post('/inventorySettings/groups', payload)).data;
export const updateProductGroup = async (id, payload) => (await api.put(`/inventorySettings/groups/${id}`, payload)).data;
export const deleteProductGroup = async (id) => (await api.delete(`/inventorySettings/groups/${id}`)).data;

// ----- BRANCHES -----
export const createBranch = async (payload) => (await api.post('/inventorySettings/branches', payload)).data;
export const getBranch = async (id) => (await api.get(`/inventorySettings/branches/${id}`)).data;
export const updateBranch = async (id, payload) => (await api.put(`/inventorySettings/branches/${id}`, payload)).data;
export const deleteBranch = async (id) => (await api.delete(`/inventorySettings/branches/${id}`)).data;
export const listBranches = async (params) => (await api.get('/inventorySettings/branches', { params })).data;
