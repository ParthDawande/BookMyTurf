import client from './client';

export const listNotifications = (params) => client.get('/api/notifications', { params });
export const markOneRead       = (id)     => client.put(`/api/notifications/${id}/read`);
export const markAllRead       = ()       => client.put('/api/notifications/mark-all-read');
