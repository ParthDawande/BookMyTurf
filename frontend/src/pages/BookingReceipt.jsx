import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBooking, cancelBooking } from '../api/bookings';
import { getMyReview, createReview, updateReview, deleteReview } from '../api/reviews';
import { createComplaint } from '../api/complaints';
import { createQuery } from '../api/queries';
import Header from '../components/Header';
import CustomerNav from '../components/CustomerNav';

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

// ── Star rating components ────────────────────────────────────────────────────

function StarDisplay({ rating }) {
  return (
    <span>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ color: n <= rating ? '#f59e0b' : '#d1d5db', fontSize: '1.1rem' }}>★</span>
      ))}
    </span>
  );
}

function StarSelector({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: 'inline-flex', gap: '0.15rem', cursor: 'pointer' }}>
      {[1,2,3,4,5].map(n => (
        <span
          key={n}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{ fontSize: '1.6rem', color: n <= (hover || value) ? '#f59e0b' : '#d1d5db', lineHeight: 1 }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ── Delete review confirmation modal ─────────────────────────────────────────

function DeleteReviewModal({ open, onConfirm, onCancel, deleting }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '380px', width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#b91c1c', margin: '0 0 0.6rem', fontSize: '1rem' }}>Delete your review?</h3>
        <p style={{ color: '#555', fontSize: '0.88rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onConfirm} disabled={deleting} style={{
            flex: 1, padding: '0.6rem', background: deleting ? '#fca5a5' : '#dc2626',
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: deleting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
          }}>
            {deleting ? 'Deleting…' : 'Delete review'}
          </button>
          <button onClick={onCancel} disabled={deleting} style={{
            padding: '0.6rem 1.1rem', background: 'transparent',
            border: '1px solid #d1d5db', color: '#374151', borderRadius: '5px',
            cursor: 'pointer', fontSize: '0.88rem',
          }}>
            Keep review
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Complaint / Query inline modal ───────────────────────────────────────────

function IssueModal({ open, mode, bookingId, onClose }) {
  const navigate  = useNavigate();
  const [subject,     setSubject]     = useState('');
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  if (!open) return null;

  const isComplaint = mode === 'complaint';
  const title = isComplaint ? 'Report an issue' : 'Ask a question about this booking';

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isComplaint) {
        const body = { subject, description };
        if (bookingId) body.booking_id = Number(bookingId);
        const res = await createComplaint(body);
        navigate(`/customer/complaints/${res.data.complaint_id}`);
      } else {
        const res = await createQuery({ subject, description });
        navigate(`/customer/queries/${res.data.query_id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '460px', width: '94%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.05rem' }}>{title}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
              Subject <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input type="text" required maxLength={200} value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '5px',
                border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
              Description <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea required rows={4} value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '5px',
                border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
              padding: '0.5rem 0.8rem', borderRadius: '5px', marginBottom: '0.75rem', fontSize: '0.83rem' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button type="submit" disabled={submitting} style={{
              flex: 1, padding: '0.6rem',
              background: submitting ? '#93c5fd' : (isComplaint ? '#dc2626' : '#1d4ed8'),
              color: '#fff', border: 'none', borderRadius: '5px',
              cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
            }}>
              {submitting ? 'Submitting…' : `Submit ${isComplaint ? 'complaint' : 'query'}`}
            </button>
            <button type="button" onClick={onClose} style={{
              padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
              color: '#374151', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
            }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── BookingReceipt ────────────────────────────────────────────────────────────

export default function BookingReceipt() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [booking,           setBooking]           = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(null);
  const [showCancel,        setShowCancel]        = useState(false);
  const [cancelling,        setCancelling]        = useState(false);
  const [cancelError,       setCancelError]       = useState(null);

  // Issue modal state (complaint / query)
  const [issueModal,        setIssueModal]        = useState(null); // null | 'complaint' | 'query'

  // Review state
  const [review,            setReview]            = useState(null);
  const [reviewFormOpen,    setReviewFormOpen]    = useState(false);
  const [reviewRating,      setReviewRating]      = useState(5);
  const [reviewComment,     setReviewComment]     = useState('');
  const [reviewSubmitting,  setReviewSubmitting]  = useState(false);
  const [reviewError,       setReviewError]       = useState(null);
  const [reviewDeleteModal, setReviewDeleteModal] = useState(false);
  const [reviewDeleting,    setReviewDeleting]    = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getBooking(id)
      .then(res => {
        setBooking(res.data);
        if (res.data.status === 'COMPLETED') {
          getMyReview(res.data.booking_id)
            .then(r => setReview(r.data))
            .catch(() => setReview(null));
        }
      })
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

  function openReviewForm(existing) {
    setReviewRating(existing ? existing.rating : 5);
    setReviewComment(existing ? (existing.review_text || '') : '');
    setReviewError(null);
    setReviewFormOpen(true);
  }

  async function handleReviewSubmit() {
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      if (review) {
        const res = await updateReview(review.review_id, { rating: reviewRating, review_text: reviewComment });
        setReview(res.data);
      } else {
        const res = await createReview({ booking_id: booking.booking_id, rating: reviewRating, review_text: reviewComment });
        setReview(res.data);
      }
      setReviewFormOpen(false);
    } catch (err) {
      setReviewError(err.response?.data?.error || 'Failed to save review. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleReviewDelete() {
    setReviewDeleting(true);
    try {
      await deleteReview(review.review_id);
      setReview(null);
      setReviewDeleteModal(false);
      setReviewFormOpen(false);
    } catch {
      setReviewDeleting(false);
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
      <CustomerNav />

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

        {/* Action buttons — CONFIRMED */}
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
                onClick={() => { if (canAct) navigate(`/customer/bookings/${id}/reschedule`); }}
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

        {/* Review section — COMPLETED */}
        {status === 'COMPLETED' && (
          <>
            {/* Existing review display */}
            {review && !reviewFormOpen && (
              <Section title="Your review">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <StarDisplay rating={review.rating} />
                  <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>
                    {review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''}
                  </span>
                </div>
                {review.review_text && (
                  <p style={{ color: '#374151', fontSize: '0.9rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                    {review.review_text}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button onClick={() => openReviewForm(review)} style={{
                    padding: '0.4rem 1rem', background: '#fff', color: '#2e86de',
                    border: '1px solid #2e86de', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem',
                  }}>
                    Edit review
                  </button>
                  <button onClick={() => setReviewDeleteModal(true)} style={{
                    padding: '0.4rem 1rem', background: '#fff', color: '#dc2626',
                    border: '1px solid #fca5a5', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem',
                  }}>
                    Delete
                  </button>
                </div>
              </Section>
            )}

            {/* Review form (inline) */}
            {reviewFormOpen && (
              <Section title={review ? 'Edit your review' : 'Leave a review'}>
                <div style={{ marginBottom: '0.9rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.4rem' }}>Rating</div>
                  <StarSelector value={reviewRating} onChange={setReviewRating} />
                </div>
                <div style={{ marginBottom: '0.9rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.4rem' }}>Comment</div>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Share your experience…"
                    style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '5px',
                      border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical',
                      fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                {reviewError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
                    borderRadius: '5px', padding: '0.55rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    {reviewError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <button onClick={handleReviewSubmit} disabled={reviewSubmitting} style={{
                    padding: '0.55rem 1.2rem', background: reviewSubmitting ? '#93c5fd' : '#1d4ed8',
                    color: '#fff', border: 'none', borderRadius: '5px',
                    cursor: reviewSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
                  }}>
                    {reviewSubmitting ? 'Saving…' : (review ? 'Update review' : 'Submit review')}
                  </button>
                  <button onClick={() => { setReviewFormOpen(false); setReviewError(null); }} style={{
                    background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.88rem',
                  }}>
                    Cancel
                  </button>
                  {review && (
                    <button onClick={() => setReviewDeleteModal(true)} style={{
                      marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626',
                      cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline',
                    }}>
                      Delete review
                    </button>
                  )}
                </div>
              </Section>
            )}

            {/* Review CTA (no review yet or after deletion, form closed) */}
            {!reviewFormOpen && (
              <Section>
                <button
                  onClick={() => openReviewForm(review)}
                  style={{
                    padding: '0.6rem 1.3rem', background: '#fff',
                    color: '#2e86de', border: '1px solid #2e86de',
                    borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem',
                  }}
                >
                  {review ? 'View/edit your review' : 'Leave a review'}
                </button>
              </Section>
            )}
          </>
        )}

        {/* Secondary CTAs: complaints and queries — visible for all statuses */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.9rem', marginTop: '0.5rem',
          display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          <button onClick={() => setIssueModal('complaint')} style={{
            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
            fontSize: '0.82rem', padding: 0, textDecoration: 'underline',
          }}>
            Report an issue with this booking
          </button>
          <button onClick={() => setIssueModal('query')} style={{
            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
            fontSize: '0.82rem', padding: 0, textDecoration: 'underline',
          }}>
            Have a question about this booking?
          </button>
        </div>
      </main>

      <CancelModal
        booking={showCancel ? booking : null}
        onConfirm={handleCancelConfirm}
        onKeep={() => { setShowCancel(false); setCancelError(null); }}
        cancelling={cancelling}
        cancelError={cancelError}
      />

      <DeleteReviewModal
        open={reviewDeleteModal}
        onConfirm={handleReviewDelete}
        onCancel={() => { setReviewDeleteModal(false); setReviewDeleting(false); }}
        deleting={reviewDeleting}
      />

      <IssueModal
        open={issueModal !== null}
        mode={issueModal}
        bookingId={id}
        onClose={() => setIssueModal(null)}
      />
    </div>
  );
}
