import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getPublicTurfDetail, getPublicAvailability } from '../api/turfs';
import { initiateBooking, confirmBooking } from '../api/bookings';
import { loadRazorpaySDK } from '../utils/razorpay';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';

// ── Date / time helpers ──────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// "09:00" → "9:00 AM",  "13:00" → "1:00 PM"
function fmt12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// "2026-06-25" → "Thursday, June 25, 2026"
function fmtDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Small display components ─────────────────────────────────────────────────

function RatingBadge({ avg_rating, review_count }) {
  if (!review_count) return <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No ratings yet</span>;
  return (
    <span style={{ color: '#d97706', fontSize: '0.9rem' }}>
      {Number(avg_rating).toFixed(1)} ★ · {review_count} review{review_count !== 1 ? 's' : ''}
    </span>
  );
}

function StarRow({ rating }) {
  return (
    <span style={{ color: '#d97706', letterSpacing: '1px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(Math.max(0, 5 - rating))}
    </span>
  );
}

function CoverPhoto({ url, name, height = 280 }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: '100%', height, objectFit: 'cover', borderRadius: '8px', display: 'block' }} />;
  }
  return (
    <div aria-label={`${name} — no cover photo`} style={{
      width: '100%', height,
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2e86de 100%)',
      borderRadius: '8px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '0.5rem',
    }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <span style={{ fontWeight: 600, fontSize: '1.1rem', textAlign: 'center', padding: '0 1rem' }}>{name}</span>
    </div>
  );
}

// ── Slot selection helpers ───────────────────────────────────────────────────

// Returns a new selection state when a slot is clicked.
// Rules (choice a — contiguous, replace if non-adjacent):
//   1. Different sub-court → replace with [slot]
//   2. No selection → start with [slot]
//   3. Already selected:
//      - if first slot → remove first
//      - if last or interior → keep only slots before clicked index (shrink from that end)
//   4. Not selected:
//      - adjacent to start → prepend
//      - adjacent to end   → append
//      - non-adjacent      → REPLACE with [slot]
function applySlotClick(selection, sc, slot) {
  const newScId = sc.sub_court_id;
  const { subCourtId, slots } = selection;

  if (subCourtId !== newScId || slots.length === 0) {
    return { subCourtId: newScId, scInfo: sc, slots: [slot] };
  }

  const idx = slots.findIndex(s => s.start_time === slot.start_time);
  if (idx !== -1) {
    // Already selected
    if (idx === 0) return { ...selection, slots: slots.slice(1) };
    return { ...selection, slots: slots.slice(0, idx) };
  }

  // Not selected — check adjacency
  const first = slots[0];
  const last  = slots[slots.length - 1];
  if (slot.end_time === first.start_time) return { ...selection, slots: [slot, ...slots] };
  if (slot.start_time === last.end_time)  return { ...selection, slots: [...slots, slot] };
  return { subCourtId: newScId, scInfo: sc, slots: [slot] };
}

// ── SlotGrid ──────────────────────────────────────────────────────────────────

function SlotGrid({ subCourts, selection, onSlotClick }) {
  if (!subCourts?.length) return <p style={{ color: '#888' }}>No availability data.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {subCourts.map(sc => (
        <div key={sc.sub_court_id} style={{
          background: '#fff', borderRadius: '8px', padding: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
            <strong style={{ color: '#1e3a5f', fontSize: '0.95rem' }}>{sc.name}</strong>
            <span style={{ color: '#555', fontSize: '0.8rem' }}>
              ₹{Number(sc.hourly_price).toLocaleString()}/hr · {sc.opening_hour}–{sc.closing_hour}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {sc.slots?.map(slot => {
              const isSelected = selection.subCourtId === sc.sub_court_id &&
                                 selection.slots.some(s => s.start_time === slot.start_time);
              const style = slotStyle(slot.available, isSelected);
              return (
                <button
                  key={slot.start_time}
                  disabled={!slot.available && !isSelected}
                  onClick={() => (slot.available || isSelected) && onSlotClick(sc, slot)}
                  style={style}
                  aria-pressed={isSelected}
                >
                  {slot.start_time}–{slot.end_time}
                  {isSelected ? ' ✓' : (!slot.available ? ' · Taken' : '')}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function slotStyle(available, selected) {
  const base = {
    padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid',
    fontSize: '0.78rem', fontWeight: selected || available ? 500 : 400,
  };
  if (selected) return { ...base, cursor: 'pointer', background: '#dbeafe', borderColor: '#3b82f6', color: '#1d4ed8' };
  if (available) return { ...base, cursor: 'pointer', background: '#ecfdf5', borderColor: '#6ee7b7', color: '#065f46' };
  return { ...base, cursor: 'not-allowed', background: '#f9fafb', borderColor: '#e5e7eb', color: '#9ca3af' };
}

// ── SelectionSummary ──────────────────────────────────────────────────────────

function SelectionSummary({ selection, onBookNow }) {
  const { slots, scInfo } = selection;
  if (!slots.length) return null;

  const total = slots.length * Number(scInfo.hourly_price);
  const start = slots[0].start_time;
  const end   = slots[slots.length - 1].end_time;

  return (
    <div style={{
      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
      padding: '0.9rem 1.1rem', marginTop: '1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap',
    }}>
      <span style={{ color: '#1e40af', fontSize: '0.9rem', fontWeight: 500 }}>
        {slots.length} slot{slots.length !== 1 ? 's' : ''} selected &nbsp;·&nbsp;
        {scInfo.name} &nbsp;·&nbsp; {start}–{end} &nbsp;·&nbsp;
        ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <button
        onClick={onBookNow}
        style={{
          padding: '0.5rem 1.3rem', background: '#1d4ed8', color: '#fff',
          border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
        }}
      >
        Book now
      </button>
    </div>
  );
}

// ── ReviewModal ───────────────────────────────────────────────────────────────

function ReviewModal({ open, turfDetail, selection, date, onPay, onCancel, paying }) {
  if (!open || !turfDetail || !selection.slots.length) return null;

  const { slots, scInfo, subCourtId } = selection;
  const total = slots.length * Number(scInfo.hourly_price);
  const start = slots[0].start_time;
  const end   = slots[slots.length - 1].end_time;

  // Look up sports from detail sub-courts
  const detailSC = turfDetail.sub_courts?.find(sc => sc.sub_court_id === subCourtId);
  const sports   = detailSC?.sports?.join(', ') || '';

  const row = (label, val) => (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
      <span style={{ color: '#9ca3af', minWidth: '90px' }}>{label}</span>
      <span style={{ color: '#374151', fontWeight: 500 }}>{val}</span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }} onClick={onCancel}>
      <div style={{
        background: '#fff', borderRadius: '10px', padding: '2rem',
        maxWidth: '440px', width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#1e3a5f', margin: '0 0 1.25rem', fontSize: '1.15rem' }}>Review your booking</h3>

        {row('Turf',       `${turfDetail.name}, ${turfDetail.city}`)}
        {row('Sub-court',  `${scInfo.name}${sports ? ` · ${sports}` : ''}`)}
        {row('Date',       fmtDateLong(date))}
        {row('Time',       `${fmt12(start)} – ${fmt12(end)}`)}
        {row('Slots',      `${slots.length} × ₹${Number(scInfo.hourly_price).toLocaleString('en-IN')}/hr`)}
        {row('Total',      `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            onClick={onPay}
            disabled={paying}
            style={{
              flex: 1, padding: '0.65rem', background: paying ? '#93c5fd' : '#1d4ed8',
              color: '#fff', border: 'none', borderRadius: '5px',
              cursor: paying ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem',
            }}
          >
            {paying ? 'Processing…' : `Pay ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} now`}
          </button>
          <button
            onClick={onCancel}
            disabled={paying}
            style={{
              padding: '0.65rem 1.2rem', background: 'transparent',
              border: '1px solid #d1d5db', color: '#374151',
              borderRadius: '5px', cursor: paying ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reviews section ───────────────────────────────────────────────────────────

function ReviewsSection({ reviews }) {
  return (
    <section style={{ marginTop: '2rem' }}>
      <h2 style={{ color: '#1e3a5f', marginBottom: '1rem', fontSize: '1.2rem' }}>Reviews</h2>
      {!reviews?.length ? (
        <p style={{ color: '#888' }}>No reviews yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {reviews.map(review => (
            <div key={review.review_id} style={{
              background: '#fff', borderRadius: '8px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                <strong style={{ color: '#1e3a5f', fontSize: '0.9rem' }}>{review.customer_name}</strong>
                <StarRow rating={review.rating} />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                {review.created_at?.split('T')[0]}
              </div>
              {review.review_text && (
                <p style={{ margin: '0 0 0.5rem', color: '#555', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {review.review_text}
                </p>
              )}
              {review.owner_reply && (
                <div style={{ marginLeft: '1rem', paddingLeft: '0.75rem', borderLeft: '2px solid #2e86de', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#2e86de', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Owner reply · {review.owner_reply.created_at?.split('T')[0]}
                  </div>
                  <p style={{ margin: 0, color: '#555', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {review.owner_reply.reply_text}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Slot modal for anonymous (auth wall) ─────────────────────────────────────

function AnonSlotModal({ slotInfo, onClose, onSignIn, onRegister }) {
  if (!slotInfo) return null;
  const { sc, slot } = slotInfo;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: '10px', padding: '2rem',
        maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#1e3a5f', margin: '0 0 0.25rem' }}>{sc.name}</h3>
        <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9rem' }}>{slot.start_time} – {slot.end_time}</p>
        <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🔒</div>
        <p style={{ color: '#666', fontSize: '0.9rem', maxWidth: '300px', margin: '0 auto 1.25rem' }}>
          Sign in to book this slot.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={onSignIn} style={{
            padding: '0.55rem 1.4rem', background: '#2e86de', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
          }}>Sign in</button>
          <button onClick={onRegister} style={{
            padding: '0.55rem 1.4rem', background: 'transparent',
            border: '1px solid #2e86de', color: '#2e86de',
            borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem',
          }}>Register</button>
        </div>
      </div>
    </div>
  );
}

// ── Error / info banner ───────────────────────────────────────────────────────

const BOOK_ERRORS = {
  '409': {
    bg: '#fef3c7', border: '#fcd34d', color: '#92400e',
    msg: 'This slot was just taken. Your payment has been refunded — please try a different slot.',
    cta: 'Back to availability',
  },
  '502': {
    bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c',
    msg: 'Something went wrong with your payment. Our team has been notified and will contact you.',
    cta: 'Contact support',
    ctaHref: '/support',
  },
  '400': {
    bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c',
    msg: 'Payment verification failed. If you were charged, please contact support.',
    cta: 'Contact support',
    ctaHref: '/support',
  },
  'dismissed': {
    bg: '#f9fafb', border: '#d1d5db', color: '#6b7280',
    msg: 'Payment cancelled.',
    cta: null,
  },
  'initiate_failed': {
    bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c',
    msg: 'Could not start the payment. Please try again.',
    cta: null,
  },
  'other': {
    bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c',
    msg: 'Something went wrong. Please try again.',
    cta: null,
  },
};

function BookingBanner({ code, onDismiss, onClearSelection }) {
  if (!code) return null;
  const cfg = BOOK_ERRORS[code] || BOOK_ERRORS['other'];
  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem',
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap',
    }}>
      <span style={{ flex: 1, fontSize: '0.9rem' }}>{cfg.msg}</span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {cfg.cta && (code === '409'
          ? <button onClick={onClearSelection} style={{ fontSize: '0.85rem', background: 'none', border: 'none', color: cfg.color, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>{cfg.cta}</button>
          : <a href={cfg.ctaHref} style={{ fontSize: '0.85rem', color: cfg.color }}>{cfg.cta}</a>
        )}
        <button onClick={onDismiss} style={{ fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: cfg.color, lineHeight: 1 }}>✕</button>
      </div>
    </div>
  );
}

// ── TurfDetail (main export) ──────────────────────────────────────────────────

export default function TurfDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { isAuthenticated, hasRole, user } = useAuth();

  const isCustomer = isAuthenticated && hasRole('CUSTOMER');

  const listTurf = location.state?.turf;

  const [detail,   setDetail]   = useState(null);
  const [loadingD, setLoadingD] = useState(false);
  const [errorD,   setErrorD]   = useState(null);

  const [date,     setDate]     = useState(todayISO);
  const [avail,    setAvail]    = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const [errorA,   setErrorA]   = useState(null);

  // Slot selection: { subCourtId: number|null, scInfo: object|null, slots: [] }
  const [selection, setSelection] = useState({ subCourtId: null, scInfo: null, slots: [] });

  // Booking flow state
  const [reviewOpen,  setReviewOpen]  = useState(false);
  const [paying,      setPaying]      = useState(false);
  const [bookError,   setBookError]   = useState(null);  // key into BOOK_ERRORS

  // Anonymous slot-click modal (for non-customer visitors)
  const [anonSlot, setAnonSlot] = useState(null);

  // Fetch turf detail — public endpoint, no auth required
  useEffect(() => {
    setLoadingD(true);
    setErrorD(null);
    getPublicTurfDetail(id)
      .then(res => setDetail(res.data))
      .catch(err => setErrorD(err.response?.data?.error || "Couldn't load turf details."))
      .finally(() => setLoadingD(false));
  }, [id]);

  // Fetch availability when date changes — public endpoint
  useEffect(() => {
    setLoadingA(true);
    setErrorA(null);
    setAvail(null);
    setSelection({ subCourtId: null, scInfo: null, slots: [] });
    getPublicAvailability(id, date)
      .then(res => setAvail(res.data))
      .catch(err => setErrorA(err.response?.data?.error || "Couldn't load availability."))
      .finally(() => setLoadingA(false));
  }, [id, date]);

  const hero     = detail || listTurf;
  const coverUrl = detail ? (detail.photos?.[0] ?? null) : (listTurf?.cover_photo_url ?? null);

  // ── Slot click handler ──────────────────────────────────────────────────────
  function handleSlotClick(sc, slot) {
    if (!isCustomer) {
      setAnonSlot({ sc, slot });
      return;
    }
    setBookError(null);
    setSelection(prev => applySlotClick(prev, sc, slot));
  }

  // ── Booking flow ────────────────────────────────────────────────────────────
  async function handlePay() {
    if (!selection.slots.length) return;
    setPaying(true);
    setBookError(null);

    try {
      await loadRazorpaySDK();

      const body = {
        sub_court_id: selection.subCourtId,
        booking_date: date,
        slots: selection.slots.map(s => ({ start_time: s.start_time, end_time: s.end_time })),
      };

      const { data: order } = await initiateBooking(body);
      // order: { razorpay_order_id, razorpay_key_id, total_amount, ... }

      // Close review modal; Razorpay modal will overlay
      setReviewOpen(false);

      const rzp = new window.Razorpay({
        key:         order.razorpay_key_id,
        order_id:    order.razorpay_order_id,
        amount:      Math.round(Number(order.total_amount) * 100),
        currency:    'INR',
        name:        'BookMyTurf',
        description: `${detail?.name || ''} - ${selection.scInfo?.name || ''}`,
        prefill:     { email: user?.email || '', contact: '' },
        handler: async (rzpPayload) => {
          // rzpPayload: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
          try {
            const { data: confirmed } = await confirmBooking({
              razorpay_order_id:    rzpPayload.razorpay_order_id,
              razorpay_payment_id:  rzpPayload.razorpay_payment_id,
              razorpay_signature:   rzpPayload.razorpay_signature,
            });
            navigate(`/customer/bookings/${confirmed.booking_id}`);
          } catch (err) {
            const status = err.response?.status;
            if (status === 409)       setBookError('409');
            else if (status === 502)  setBookError('502');
            else if (status === 400)  setBookError('400');
            else                      setBookError('other');
            if (status === 409) setSelection({ subCourtId: null, scInfo: null, slots: [] });
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBookError('dismissed');
            setPaying(false);
          },
        },
      });
      rzp.open();
      // paying stays true while Razorpay modal is open; reset in handler/ondismiss

    } catch (err) {
      setBookError('initiate_failed');
      setPaying(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', color: '#2e86de',
          cursor: 'pointer', fontSize: '0.88rem', padding: 0, marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.25rem',
        }}>← Back</button>

        {/* Booking banner */}
        <BookingBanner
          code={bookError}
          onDismiss={() => setBookError(null)}
          onClearSelection={() => { setBookError(null); setSelection({ subCourtId: null, scInfo: null, slots: [] }); }}
        />

        {/* ── Hero ── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <CoverPhoto url={coverUrl} name={hero?.name || 'Turf'} height={280} />
          {hero && (
            <div style={{ marginTop: '1rem' }}>
              <h1 style={{ margin: '0 0 0.2rem', color: '#1e3a5f', fontSize: '1.6rem', fontWeight: 700 }}>{hero.name}</h1>
              <p style={{ margin: '0 0 0.4rem', color: '#666', fontSize: '0.9rem' }}>
                {hero.city}{hero.address ? ` · ${hero.address}` : ''}
              </p>
              <RatingBadge avg_rating={hero.avg_rating} review_count={hero.review_count} />
              {hero.description && (
                <p style={{ marginTop: '0.75rem', color: '#555', lineHeight: 1.65, fontSize: '0.92rem' }}>{hero.description}</p>
              )}
            </div>
          )}
        </div>

        {/* Detail load state */}
        {loadingD && <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Loading…</div>}
        {errorD && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            {errorD}
          </div>
        )}

        {detail && (
          <>
            {/* Sub-courts */}
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ color: '#1e3a5f', marginBottom: '1rem', fontSize: '1.2rem' }}>Sub-courts</h2>
              {!detail.sub_courts?.length ? (
                <p style={{ color: '#888' }}>No sub-courts listed.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {detail.sub_courts.map(sc => (
                    <div key={sc.sub_court_id} style={{
                      background: '#fff', borderRadius: '8px', padding: '1rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                      display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
                      alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <strong style={{ color: '#1e3a5f', fontSize: '0.95rem' }}>{sc.name}</strong>
                        <div style={{ fontSize: '0.82rem', color: '#777', marginTop: '0.2rem' }}>
                          {sc.sports?.join(', ')} · {sc.opening_hour}–{sc.closing_hour}
                        </div>
                      </div>
                      <span style={{ color: '#2e86de', fontWeight: 600, fontSize: '0.95rem' }}>
                        ₹{Number(sc.hourly_price).toLocaleString()}/hr
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Availability + selection */}
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ color: '#1e3a5f', marginBottom: '1rem', fontSize: '1.2rem' }}>Check Availability</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <label style={{ color: '#555', fontSize: '0.9rem' }}>
                  Date:
                  <input
                    type="date" value={date} min={todayISO()}
                    onChange={e => setDate(e.target.value)}
                    style={{ marginLeft: '0.5rem', padding: '0.35rem 0.55rem', borderRadius: '4px', border: '1px solid #d0d5dd', fontSize: '0.85rem' }}
                  />
                </label>
              </div>

              {loadingA && <div style={{ color: '#888', fontSize: '0.9rem' }}>Loading availability…</div>}
              {errorA   && <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{errorA}</div>}
              {avail && (
                <>
                  <SlotGrid
                    subCourts={avail.sub_courts}
                    selection={selection}
                    onSlotClick={handleSlotClick}
                  />
                  {isCustomer && (
                    <SelectionSummary
                      selection={selection}
                      onBookNow={() => setReviewOpen(true)}
                    />
                  )}
                  {!isCustomer && selection.slots.length > 0 && null}
                </>
              )}
            </section>

            {/* Reviews */}
            <ReviewsSection reviews={detail.recent_reviews} />
          </>
        )}
      </main>

      {/* Anonymous slot-click auth modal */}
      <AnonSlotModal
        slotInfo={anonSlot}
        onClose={() => setAnonSlot(null)}
        onSignIn={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      {/* Review modal (authenticated customer) */}
      <ReviewModal
        open={reviewOpen}
        turfDetail={detail}
        selection={selection}
        date={date}
        onPay={handlePay}
        onCancel={() => setReviewOpen(false)}
        paying={paying}
      />
    </div>
  );
}
