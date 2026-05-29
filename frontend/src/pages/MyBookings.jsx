import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listBookings } from '../api/bookings';
import Header from '../components/Header';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function fmt12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  CONFIRMED:  { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  COMPLETED:  { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  CANCELLED:  { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  REFUNDED:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.COMPLETED;
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
      fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.03em',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textDecoration: status === 'CANCELLED' ? 'line-through' : 'none',
    }}>
      {status}
    </span>
  );
}

// ── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({ booking, onView }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '10px', padding: '1.2rem 1.4rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.4rem' }}>
        <button
          onClick={() => onView(booking.turf_id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: '#1e3a5f', fontWeight: 700, fontSize: '1rem', textAlign: 'left' }}
        >
          {booking.turf_name}
        </button>
        <StatusBadge status={booking.status} />
      </div>

      <div style={{ fontSize: '0.85rem', color: '#555' }}>
        {booking.sub_court_name}
      </div>

      <div style={{ fontSize: '0.88rem', color: '#444', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <span>{fmtDateLong(booking.booking_date)}</span>
        {booking.first_slot_start && booking.last_slot_end && (
          <span>{fmt12(booking.first_slot_start)} – {fmt12(booking.last_slot_end)}</span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
        <span style={{ fontWeight: 600, color: '#1e3a5f', fontSize: '0.95rem' }}>
          ₹{Number(booking.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
        <button
          onClick={() => onView(null, booking.booking_id)}
          style={{
            padding: '0.4rem 1rem', background: '#2e86de', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
          }}
        >
          View details
        </button>
      </div>
    </div>
  );
}

// ── MyBookings ────────────────────────────────────────────────────────────────

const STATUSES = ['All', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];

export default function MyBookings() {
  const navigate      = useNavigate();
  const [params, setParams] = useSearchParams();

  const statusParam = params.get('status') || '';
  const pageParam   = parseInt(params.get('page') || '0', 10);

  const [bookings,   setBookings]   = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const p = { page: pageParam, size: 10 };
    if (statusParam) p.status = statusParam;
    listBookings(p)
      .then(res => {
        setBookings(res.data.bookings || []);
        setTotalPages(res.data.total_pages || 0);
        setTotal(res.data.total_results || 0);
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load bookings.'))
      .finally(() => setLoading(false));
  }, [statusParam, pageParam]);

  function setFilter(status) {
    const next = new URLSearchParams();
    if (status && status !== 'All') next.set('status', status);
    next.set('page', '0');
    setParams(next);
  }

  function setPage(p) {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  }

  const activeFilter = statusParam || 'All';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* Title + Book another */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.5rem', fontWeight: 700 }}>My Bookings</h1>
          <button
            onClick={() => navigate('/turfs')}
            style={{
              padding: '0.45rem 1.1rem', background: '#2e86de', color: '#fff',
              border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500,
            }}
          >
            + Book another
          </button>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 500,
                cursor: 'pointer',
                background: activeFilter === s ? '#1e3a5f' : '#fff',
                color:      activeFilter === s ? '#fff'    : '#555',
                border:     `1px solid ${activeFilter === s ? '#1e3a5f' : '#d1d5db'}`,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.9rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading…</div>
        )}

        {/* Empty state */}
        {!loading && !error && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#555' }}>
              {statusParam
                ? `No ${statusParam} bookings.`
                : "You haven't made any bookings yet."}
            </p>
            <button
              onClick={() => navigate('/turfs')}
              style={{ color: '#2e86de', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.95rem', textDecoration: 'underline', padding: 0 }}
            >
              Browse turfs →
            </button>
          </div>
        )}

        {/* Booking cards */}
        {!loading && bookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {bookings.map(b => (
              <BookingCard
                key={b.booking_id}
                booking={b}
                onView={(turfId, bookingId) => {
                  if (bookingId) navigate(`/customer/bookings/${bookingId}`);
                  else navigate(`/turfs/${turfId}`);
                }}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPage(pageParam - 1)}
              disabled={pageParam === 0}
              style={pageBtnStyle(pageParam === 0)}
            >← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i} onClick={() => setPage(i)}
                style={pageBtnStyle(false, i === pageParam)}
              >{i + 1}</button>
            ))}
            <button
              onClick={() => setPage(pageParam + 1)}
              disabled={pageParam >= totalPages - 1}
              style={pageBtnStyle(pageParam >= totalPages - 1)}
            >Next →</button>
          </div>
        )}
      </main>
    </div>
  );
}

function pageBtnStyle(disabled, active = false) {
  return {
    padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? '#1e3a5f' : disabled ? '#f3f4f6' : '#fff',
    color: active ? '#fff' : disabled ? '#9ca3af' : '#374151',
    border: `1px solid ${active ? '#1e3a5f' : '#d1d5db'}`,
  };
}
