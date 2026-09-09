import client from './client';

export const listRoles = () => client.get('/roles').then((r) => r.data);
export const createRole = (data) => client.post('/roles', data).then((r) => r.data);
export const updateRole = (id, data) => client.put(`/roles/${id}`, data).then((r) => r.data);
export const deleteRole = (id) => client.delete(`/roles/${id}`).then((r) => r.data);
export const updateRolePermissions = (id, permissions) => client.put(`/roles/${id}/permissions`, { permissions }).then((r) => r.data);
export const listPermissions = (module) => client.get('/permissions', { params: module ? { module } : {} }).then((r) => r.data);
export const createPermission = (data) => client.post('/permissions', data).then((r) => r.data);
export const updatePermission = (id, data) => client.put(`/permissions/${id}`, data).then((r) => r.data);
export const deletePermission = (id) => client.delete(`/permissions/${id}`).then((r) => r.data);
export const getUserRoles = (userId) => client.get(`/users/${userId}/roles`).then((r) => r.data);
export const updateUserRoles = (userId, roles) => client.put(`/users/${userId}/roles`, { roles }).then((r) => r.data);
