import client from './client';

export const initiateBooking = (body)         => client.post('/api/customer/bookings/initiate', body);
export const confirmBooking  = (body)         => client.post('/api/customer/bookings/confirm', body);
export const listBookings         = (params)        => client.get('/api/customer/bookings', { params });
export const getBooking           = (id)            => client.get(`/api/customer/bookings/${id}`);
export const cancelBooking        = (id)            => client.delete(`/api/customer/bookings/${id}`);
export const rescheduleInitiate   = (id, body)      => client.post(`/api/customer/bookings/${id}/reschedule/initiate`, body);
export const rescheduleConfirm    = (id, body)      => client.put(`/api/customer/bookings/${id}/reschedule/confirm`, body);
