import api from './axios';

// ----- USERS -----
export const getUsers = async () => { const { data } = await api.get('/user/users'); return data; };
export const createUser = async (payload) => { const { data } = await api.post('/user/create-user', payload); return data; };
export const updateUser = async (userId, payload) => { const { data } = await api.put(`/user/users/${userId}`, payload); return data; };
export const deleteUser = async (userId) => { const { data } = await api.delete(`/user/users/${userId}`); return data; };

// ----- CUSTOMERS -----
export const getCustomers = async (params) => (await api.get('/user/customers', { params })).data;
export const createCustomer = async (payload) => (await api.post('/user/customers', payload)).data;
export const updateCustomer = async (id, payload) => (await api.put(`/user/customers/${id}`, payload)).data;
export const deleteCustomer = async (id) => (await api.delete(`/user/customers/${id}`)).data;
export const toggleCustomerCredit = async (id) =>  (await api.patch(`/user/customers/${id}/toggle-credit`)).data;
export const getCustomerSnapshot = async (id) => (await api.get(`/user/customers/${id}/snapshot`)).data;

// ----- SUPPLIERS -----
export const getSuppliers = async (params) => (await api.get('/user/suppliers', { params })).data;
export const createSupplier = async (payload) => (await api.post('/user/suppliers', payload)).data;
export const updateSupplier = async (id, payload) => (await api.put(`/user/suppliers/${id}`, payload)).data;
export const deleteSupplier = async (id) => (await api.delete(`/user/suppliers/${id}`)).data;

// ----- SALES REPS -----
export const getSalesReps = async (params) => (await api.get('/user/sales-reps', { params })).data;
export const createSalesRep = async (payload) => (await api.post('/user/sales-reps', payload)).data;
export const updateSalesRep = async (id, payload) => (await api.put(`/user/sales-reps/${id}`, payload)).data;
export const deleteSalesRep = async (id) => (await api.delete(`/user/sales-reps/${id}`)).data;
