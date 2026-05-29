import client from './client';

export const getDashboard = (params) => client.get('/api/admin/dashboard', { params });
