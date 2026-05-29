import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBooking, cancelBooking } from '../api/bookings';
import Header from '../components/Header';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function fmt12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtMoney(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// Client-side 24h window check.
// Compares the booking's earliest slot start to now, treating slot as IST.
// The backend is authoritative — this only enables/disables the button.
function isWithin24h(bookingDate, firstSlotStart) {
  if (!bookingDate || !firstSlotStart) return true;
  const slotIST = new Date(`${bookingDate}T${firstSlotStart}:00+05:30`);
  const diffMs  = slotIST.getTime() - Date.now();
  return diffMs <= 24 * 60 * 60 * 1000;
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  CONFIRMED:  { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  COMPLETED:  { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  CANCELLED:  { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  REFUNDED:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
};

function StatusBadge({ status, large }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.COMPLETED;
  return (
    <span style={{
      display: 'inline-block', padding: large ? '0.3rem 0.9rem' : '0.2rem 0.6rem',
      borderRadius: '999px', fontSize: large ? '0.9rem' : '0.75rem', fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textDecoration: status === 'CANCELLED' ? 'line-through' : 'none',
    }}>
      {status}
    </span>
  );
}

// ── Cancel confirmation modal ─────────────────────────────────────────────────

function CancelModal({ booking, onConfirm, onKeep, cancelling, cancelError }) {
  if (!booking) return null;
  const total = fmtMoney(booking.total_amount);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }} onClick={onKeep}>
      <div style={{
        background: '#fff', borderRadius: '10px', padding: '2rem',
        maxWidth: '420px', width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#b91c1c', margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Cancel this booking?</h3>
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: 1.6 }}>
          You'll be refunded <strong>{total}</strong> to your original payment method.
          This cannot be undone.
        </p>

        {cancelError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            borderRadius: '6px', padding: '0.7rem 0.9rem', marginBottom: '0.9rem', fontSize: '0.85rem' }}>
            {cancelError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            onClick={onConfirm}
            disabled={cancelling}
            style={{
              flex: 1, padding: '0.65rem', background: cancelling ? '#fca5a5' : '#dc2626',
              color: '#fff', border: 'none', borderRadius: '5px',
              cursor: cancelling ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem',
            }}
          >
            {cancelling ? 'Cancelling…' : 'Cancel booking'}
          </button>
          <button
            onClick={onKeep}
            disabled={cancelling}
            style={{
              padding: '0.65rem 1.2rem', background: 'transparent',
              border: '1px solid #d1d5db', color: '#374151',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Keep booking
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem 1.4rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
      {title && <h3 style={{ margin: '0 0 0.9rem', color: '#1e3a5f', fontSize: '1rem', fontWeight: 600 }}>{title}</h3>}
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.45rem', fontSize: '0.9rem' }}>
      <span style={{ color: '#9ca3af', minWidth: '110px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#374151', fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? '0.8rem' : 'inherit' }}>{value}</span>
    </div>
  );
}

// ── BookingReceipt ────────────────────────────────────────────────────────────

export default function BookingReceipt() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [booking,      setBooking]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [showCancel,   setShowCancel]   = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelError,  setCancelError]  = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getBooking(id)
      .then(res => setBooking(res.data))
      .catch(err => {
        const status = err.response?.status;
        setError(status === 404 ? 'Booking not found.' : (err.response?.data?.error || 'Failed to load booking.'));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancelConfirm() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelBooking(id);
      // P5: page state update IS the confirmation — no toast.
      // Merge cancel response into booking state.
      setBooking(prev => ({
        ...prev,
        status: res.data.status,
        refunds: res.data.refunds || [],
      }));
      setShowCancel(false);
    } catch (err) {
      const status = err.response?.status;
      if (status === 502) {
        setCancelError('Cancellation failed. Your booking is unchanged. Please try again or contact support.');
      } else if (status === 400) {
        setCancelError(err.response?.data?.error || 'Cannot cancel at this time.');
      } else if (!err.response) {
        setCancelError("Couldn't reach the server. Please check your connection and try again.");
      } else {
        setCancelError('Something went wrong. Please try again.');
      }
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        <Header />
        <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>❌</div>
          <p style={{ color: '#555', marginBottom: '1rem' }}>{error}</p>
          <button onClick={() => navigate('/customer/bookings')}
            style={{ color: '#2e86de', background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline', fontSize: '0.95rem' }}>
            ← Back to My Bookings
          </button>
        </main>
      </div>
    );
  }

  const { turf, booking_date, slots = [], total_amount, payments = [], refunds = [], status } = booking;
  const firstSlotStart = slots[0]?.start_time;

  // 24h-window check for button state
  const withinWindow = isWithin24h(booking_date, firstSlotStart);
  const canAct       = status === 'CONFIRMED' && !withinWindow;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Back */}
        <button onClick={() => navigate('/customer/bookings')} style={{
          background: 'none', border: 'none', color: '#2e86de', cursor: 'pointer',
          fontSize: '0.88rem', padding: 0, marginBottom: '1rem',
        }}>← My Bookings</button>

        {/* Header: title + status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
            Booking #{booking.booking_id}
          </h1>
          <StatusBadge status={status} large />
        </div>

        {/* Turf + sub-court */}
        <Section>
          <button
            onClick={() => navigate(`/turfs/${turf.turf_id}`)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: '#1e3a5f', fontWeight: 700, fontSize: '1.1rem', display: 'block',
              marginBottom: '0.4rem', textAlign: 'left' }}
          >
            {turf.turf_name}
          </button>
          <Row label="Sub-court"  value={turf.sub_court_name} />
          <Row label="Location"   value={`${turf.address}, ${turf.city}`} />
          <Row label="Contact"    value={turf.owner_contact} />
        </Section>

        {/* Booking details */}
        <Section title="Booking Details">
          <Row label="Date"    value={fmtDateLong(booking_date)} />
          <Row label="Booked"  value={fmtDateTime(booking.booked_on)} />
          <div style={{ marginBottom: '0.45rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.9rem', display: 'block', marginBottom: '0.3rem' }}>Slots</span>
            {slots.map((s, i) => (
              <div key={i} style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500, marginLeft: '8px', marginBottom: '0.15rem' }}>
                {fmt12(s.start_time)} – {fmt12(s.end_time)}
                <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '0.4rem' }}>
                  {fmtMoney(s.rate_at_booking)}/hr
                </span>
              </div>
            ))}
          </div>
          <Row label="Total" value={fmtMoney(total_amount)} />
        </Section>

        {/* Payments */}
        <Section title="Payments">
          {payments.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>No payment records.</p>
          ) : payments.map((p, i) => (
            <div key={p.payment_id} style={{ marginBottom: i < payments.length - 1 ? '0.75rem' : 0 }}>
              <div style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>
                {payments.length > 1
                  ? (i === 0 ? 'Original payment: ' : 'Additional charge: ')
                  : 'Paid '}
                {fmtMoney(p.amount)}
                <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '0.4rem' }}>
                  on {fmtDateTime(p.paid_on)}
                </span>
              </div>
              {p.payment_method && (
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.1rem' }}>{p.payment_method}</div>
              )}
              {p.gateway_transaction_id && (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', marginTop: '0.1rem' }}>
                  {p.gateway_transaction_id}
                </div>
              )}
            </div>
          ))}
        </Section>

        {/* Refunds (only if non-empty) */}
        {refunds.length > 0 && (
          <Section title="Refunds">
            {refunds.map((r, i) => (
              <div key={r.refund_id} style={{ marginBottom: i < refunds.length - 1 ? '0.75rem' : 0 }}>
                <div style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>
                  {refunds.length > 1 && i > 0 ? 'Reschedule refund: ' : 'Refunded '}
                  {fmtMoney(r.amount)}
                  {r.processed_at && (
                    <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '0.4rem' }}>
                      on {fmtDateTime(r.processed_at)}
                    </span>
                  )}
                </div>
                {r.razorpay_refund_id && (
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', marginTop: '0.1rem' }}>
                    {r.razorpay_refund_id}
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Action buttons */}
        {status === 'CONFIRMED' && (
          <Section>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => { if (canAct) setShowCancel(true); }}
                disabled={!canAct}
                style={{
                  padding: '0.6rem 1.3rem',
                  background: canAct ? '#dc2626' : '#f3f4f6',
                  color: canAct ? '#fff' : '#9ca3af',
                  border: `1px solid ${canAct ? '#dc2626' : '#e5e7eb'}`,
                  borderRadius: '5px', cursor: canAct ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem', fontWeight: 500,
                }}
              >
                Cancel booking
              </button>
              <button
                onClick={() => alert('Reschedule coming in next sub-phase.')}
                disabled={!canAct}
                style={{
                  padding: '0.6rem 1.3rem',
                  background: canAct ? '#fff' : '#f3f4f6',
                  color: canAct ? '#2e86de' : '#9ca3af',
                  border: `1px solid ${canAct ? '#2e86de' : '#e5e7eb'}`,
                  borderRadius: '5px', cursor: canAct ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem', fontWeight: 500,
                }}
              >
                Reschedule
              </button>
            </div>
            {!canAct && (
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.82rem', color: '#9ca3af' }}>
                Cancel and reschedule are unavailable within 24 hours of start time.
              </p>
            )}
          </Section>
        )}

        {status === 'COMPLETED' && (
          <Section>
            <button
              onClick={() => alert('Reviews coming in next sub-phase.')}
              style={{
                padding: '0.6rem 1.3rem', background: '#fff', color: '#2e86de',
                border: '1px solid #2e86de', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem',
              }}
            >
              Leave a review
            </button>
          </Section>
        )}
      </main>

      <CancelModal
        booking={showCancel ? booking : null}
        onConfirm={handleCancelConfirm}
        onKeep={() => { setShowCancel(false); setCancelError(null); }}
        cancelling={cancelling}
        cancelError={cancelError}
      />
    </div>
  );
}
