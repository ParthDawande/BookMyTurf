import client from './client';

export const initiateBooking = (body) => client.post('/api/customer/bookings/initiate', body);
export const confirmBooking  = (body) => client.post('/api/customer/bookings/confirm', body);
