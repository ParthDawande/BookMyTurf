import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createComplaint } from '../api/complaints';
import { listBookings } from '../api/bookings';
import Header from '../components/Header';
import CustomerNav from '../components/CustomerNav';

export default function ComplaintNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preBookingId = searchParams.get('booking_id') || '';

  const [subject,     setSubject]     = useState('');
  const [description, setDescription] = useState('');
  const [bookingId,   setBookingId]   = useState(preBookingId);
  const [bookings,    setBookings]    = useState([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    listBookings({ page: 0, size: 50 })
      .then(res => setBookings(res.data.bookings || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = { subject, description };
      if (bookingId) body.booking_id = Number(bookingId);
      const res = await createComplaint(body);
      navigate(`/customer/complaints/${res.data.complaint_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit complaint. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <CustomerNav />
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <button onClick={() => navigate('/customer/complaints')}
          style={{ background: 'none', border: 'none', color: '#2e86de', cursor: 'pointer', fontSize: '0.88rem', padding: 0, marginBottom: '1rem' }}>
          ← Complaints
        </button>

        <h1 style={{ margin: '0 0 1.5rem', color: '#1e3a5f', fontSize: '1.35rem', fontWeight: 700 }}>
          Raise a complaint
        </h1>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <form onSubmit={handleSubmit}>
            {/* Booking (optional) */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                Related booking (optional)
              </label>
              <select value={bookingId} onChange={e => setBookingId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '5px',
                  border: '1px solid #d1d5db', fontSize: '0.9rem', color: '#374151', background: '#fff' }}>
                <option value="">General complaint (no specific booking)</option>
                {bookings.map(b => (
                  <option key={b.booking_id} value={b.booking_id}>
                    Booking #{b.booking_id} — {b.turf_name} ({b.booking_date})
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                Subject <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text" required maxLength={200}
                value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Briefly describe the issue"
                style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '5px',
                  border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                Description <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                required rows={5}
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Provide details about the issue…"
                style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '5px',
                  border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
                padding: '0.6rem 0.9rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} style={{
              width: '100%', padding: '0.65rem',
              background: submitting ? '#93c5fd' : '#dc2626',
              color: '#fff', border: 'none', borderRadius: '5px',
              cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem',
            }}>
              {submitting ? 'Submitting…' : 'Submit complaint'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
