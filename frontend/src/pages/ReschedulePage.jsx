import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBooking, rescheduleInitiate, rescheduleConfirm } from '../api/bookings';
import { getPublicAvailability } from '../api/turfs';
import { loadRazorpaySDK } from '../utils/razorpay';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().split('T')[0]; }

function fmtDateLong(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function fmt12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function fmtMoney(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ── Slot selection (same contiguous-only logic as TurfDetail) ─────────────────

function applySlotClick(selection, sc, slot) {
  const newScId = sc.sub_court_id;
  const { subCourtId, slots } = selection;
  if (subCourtId !== newScId || slots.length === 0) return { subCourtId: newScId, scInfo: sc, slots: [slot] };
  const idx = slots.findIndex(s => s.start_time === slot.start_time);
  if (idx !== -1) {
    if (idx === 0) return { ...selection, slots: slots.slice(1) };
    return { ...selection, slots: slots.slice(0, idx) };
  }
  const first = slots[0], last = slots[slots.length - 1];
  if (slot.end_time === first.start_time) return { ...selection, slots: [slot, ...slots] };
  if (slot.start_time === last.end_time)  return { ...selection, slots: [...slots, slot] };
  return { subCourtId: newScId, scInfo: sc, slots: [slot] };
}

// ── SlotGrid (single sub-court) ───────────────────────────────────────────────

function SlotGrid({ subCourt, selection, onSlotClick }) {
  if (!subCourt) return <p style={{ color: '#888', fontSize: '0.9rem' }}>No availability for this date.</p>;
  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.88rem' }}>
        <strong style={{ color: '#1e3a5f' }}>{subCourt.name}</strong>
        <span style={{ color: '#555' }}>₹{Number(subCourt.hourly_price).toLocaleString()}/hr · {subCourt.opening_hour}–{subCourt.closing_hour}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {subCourt.slots?.map(slot => {
          const sel = selection.subCourtId === subCourt.sub_court_id &&
                      selection.slots.some(s => s.start_time === slot.start_time);
          const style = sel
            ? { background: '#dbeafe', borderColor: '#3b82f6', color: '#1d4ed8', fontWeight: 500, cursor: 'pointer' }
            : slot.available
              ? { background: '#ecfdf5', borderColor: '#6ee7b7', color: '#065f46', fontWeight: 500, cursor: 'pointer' }
              : { background: '#f9fafb', borderColor: '#e5e7eb', color: '#9ca3af', cursor: 'not-allowed' };
          return (
            <button
              key={slot.start_time}
              disabled={!slot.available && !sel}
              onClick={() => (slot.available || sel) && onSlotClick(subCourt, slot)}
              style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid', fontSize: '0.78rem', ...style }}
              aria-pressed={sel}
            >
              {slot.start_time}–{slot.end_time}{sel ? ' ✓' : !slot.available ? ' · Taken' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ open, booking, newDate, slots, priceDiff, initiateData, onConfirm, onCancel, confirming, confirmError }) {
  if (!open || !booking || !initiateData) return null;
  const ac = initiateData.action_required;
  const isPayment = ac === 'PAYMENT';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '2rem', maxWidth: '440px', width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>

        <h3 style={{ color: '#1e3a5f', margin: '0 0 1rem', fontSize: '1.1rem' }}>
          {isPayment ? `Pay ${fmtMoney(initiateData.price_diff)} additional to reschedule?`
                     : `Confirm reschedule?`}
        </h3>

        {/* Old vs new */}
        <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <div style={{ marginBottom: '0.4rem', color: '#6b7280' }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>Current: </span>
            {fmtDateLong(booking.booking_date)} · {fmt12(booking.slots[0]?.start_time)}–{fmt12(booking.slots[booking.slots.length-1]?.end_time)} · {fmtMoney(initiateData.old_total)}
          </div>
          <div style={{ color: '#6b7280' }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>New: </span>
            {fmtDateLong(newDate)} · {slots.length > 0 ? `${fmt12(slots[0].start_time)}–${fmt12(slots[slots.length-1].end_time)}` : '—'} · {fmtMoney(initiateData.new_total)}
          </div>
        </div>

        {ac === 'REFUND' && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '0.6rem 0.9rem', marginBottom: '1rem', color: '#166534', fontSize: '0.88rem' }}>
            You'll be refunded {fmtMoney(Math.abs(Number(initiateData.price_diff)))} to your original payment method.
          </div>
        )}

        {confirmError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '6px', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {confirmError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button onClick={onConfirm} disabled={confirming} style={{
            flex: 1, padding: '0.65rem',
            background: confirming ? '#93c5fd' : (isPayment ? '#1d4ed8' : '#166534'),
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: confirming ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem',
          }}>
            {confirming ? 'Processing…' : isPayment ? `Pay ${fmtMoney(initiateData.price_diff)} now` : 'Confirm reschedule'}
          </button>
          <button onClick={onCancel} disabled={confirming} style={{
            padding: '0.65rem 1.2rem', background: 'transparent',
            border: '1px solid #d1d5db', color: '#374151', borderRadius: '5px',
            cursor: 'pointer', fontSize: '0.9rem',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ReschedulePage ─────────────────────────────────────────────────────────────

export default function ReschedulePage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking,      setBooking]      = useState(null);
  const [loadingB,     setLoadingB]     = useState(true);
  const [errorB,       setErrorB]       = useState(null);

  const [date,         setDate]         = useState(todayISO());
  const [avail,        setAvail]        = useState(null);
  const [loadingA,     setLoadingA]     = useState(false);

  const [selection,    setSelection]    = useState({ subCourtId: null, scInfo: null, slots: [] });

  const [initiating,   setInitiating]   = useState(false);
  const [initiateData, setInitiateData] = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [confirming,   setConfirming]   = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  const [pageError,    setPageError]    = useState(null);

  // Load booking
  useEffect(() => {
    setLoadingB(true);
    getBooking(id)
      .then(res => {
        const b = res.data;
        if (b.status !== 'CONFIRMED') { navigate(`/customer/bookings/${id}`); return; }
        setBooking(b);
        setDate(b.booking_date);
      })
      .catch(err => setErrorB(err.response?.data?.error || 'Failed to load booking.'))
      .finally(() => setLoadingB(false));
  }, [id]);

  // Load availability when date or turf changes
  useEffect(() => {
    if (!booking) return;
    setLoadingA(true);
    setAvail(null);
    setSelection({ subCourtId: null, scInfo: null, slots: [] });
    getPublicAvailability(booking.turf.turf_id, date)
      .then(res => setAvail(res.data))
      .catch(() => setAvail(null))
      .finally(() => setLoadingA(false));
  }, [booking, date]);

  // The sub-court to show: match by name from availability response
  const subCourtAvail = avail?.sub_courts?.find(sc => sc.name === booking?.turf?.sub_court_name) || null;

  // Price diff (client-side preview)
  const hourlyRate = subCourtAvail ? Number(subCourtAvail.hourly_price) : 0;
  const currentTotal = booking ? Number(booking.total_amount) : 0;
  const newTotal = selection.slots.length * hourlyRate;
  const priceDiff = newTotal - currentTotal;

  // Can continue: slots selected AND different from current (not no-op)
  const currentSlotSet = new Set((booking?.slots || []).map(s => s.start_time));
  const newSlotSet = new Set(selection.slots.map(s => s.start_time));
  const sameSlots = booking && date === booking.booking_date &&
                    selection.slots.length === booking.slots.length &&
                    [...newSlotSet].every(t => currentSlotSet.has(t));
  const canContinue = selection.slots.length > 0 && !sameSlots;

  function handleSlotClick(sc, slot) {
    setSelection(prev => applySlotClick(prev, sc, slot));
    setConfirmError(null);
  }

  async function handleContinue() {
    if (!canContinue) return;
    setInitiating(true);
    setPageError(null);
    try {
      const body = {
        new_booking_date: date,
        new_slots: selection.slots.map(s => ({ start_time: s.start_time, end_time: s.end_time })),
      };
      const { data } = await rescheduleInitiate(id, body);
      setInitiateData(data);
      setModalOpen(true);
    } catch (err) {
      setPageError(err.response?.data?.error || 'Failed to start reschedule. Please try again.');
    } finally {
      setInitiating(false);
    }
  }

  async function handleConfirm() {
    if (!initiateData) return;
    setConfirming(true);
    setConfirmError(null);

    if (initiateData.action_required === 'PAYMENT') {
      // Razorpay flow
      try {
        await loadRazorpaySDK();
        setModalOpen(false);
        const rzp = new window.Razorpay({
          key:         initiateData.razorpay_key_id,
          order_id:    initiateData.razorpay_order_id,
          amount:      Math.round(Number(initiateData.price_diff) * 100),
          currency:    'INR',
          name:        'BookMyTurf',
          description: `Reschedule — ${booking?.turf?.turf_name || ''}`,
          prefill:     { email: user?.email || '', contact: '' },
          handler: async (rzpPayload) => {
            try {
              await rescheduleConfirm(id, {
                reschedule_token:      initiateData.reschedule_token,
                razorpay_order_id:     rzpPayload.razorpay_order_id,
                razorpay_payment_id:   rzpPayload.razorpay_payment_id,
                razorpay_signature:    rzpPayload.razorpay_signature,
              });
              navigate(`/customer/bookings/${id}`);
            } catch (err) {
              const status = err.response?.status;
              if (status === 409) {
                const msg = err.response?.data?.error || '';
                if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('pric')) {
                  setPageError('Rates changed since you started. Please review and try again.');
                } else {
                  setPageError('One of your selected slots was just taken. Please pick again.');
                  setSelection({ subCourtId: null, scInfo: null, slots: [] });
                  // Refetch availability
                  getPublicAvailability(booking.turf.turf_id, date).then(r => setAvail(r.data)).catch(() => {});
                }
              } else if (status === 400) {
                setPageError('Reschedule session expired. Please start again.');
                navigate(`/customer/bookings/${id}`);
              } else {
                setPageError('Something went wrong. Please try again.');
              }
              setConfirming(false);
            }
          },
          modal: {
            ondismiss: () => {
              setPageError('Payment cancelled.');
              setConfirming(false);
            },
          },
        });
        rzp.open();
      } catch {
        setConfirmError('Could not start payment. Please try again.');
        setConfirming(false);
      }
      return;
    }

    // NONE or REFUND — just confirm with token
    try {
      await rescheduleConfirm(id, { reschedule_token: initiateData.reschedule_token });
      navigate(`/customer/bookings/${id}`);
    } catch (err) {
      const status = err.response?.status;
      if (status === 400) {
        setConfirmError('Reschedule session expired. Please start again.');
        setModalOpen(false);
        setTimeout(() => navigate(`/customer/bookings/${id}`), 2000);
      } else if (status === 409) {
        const msg = err.response?.data?.error || '';
        if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('pric')) {
          setConfirmError('Rates changed since you started. Please review and try again.');
          setModalOpen(false);
        } else {
          setConfirmError('One of your selected slots was just taken. Please pick again.');
          setModalOpen(false);
          setSelection({ subCourtId: null, scInfo: null, slots: [] });
          getPublicAvailability(booking.turf.turf_id, date).then(r => setAvail(r.data)).catch(() => {});
        }
      } else if (status === 502) {
        setConfirmError('Reschedule failed. Your booking is unchanged. Please try again.');
      } else {
        setConfirmError('Something went wrong. Please try again.');
      }
      setConfirming(false);
    }
  }

  if (loadingB) return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}><Header />
      <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>Loading…</div>
    </div>
  );
  if (errorB) return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}><Header />
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#555' }}>{errorB}</p>
        <button onClick={() => navigate(`/customer/bookings/${id}`)} style={{ color: '#2e86de', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Back to booking</button>
      </main>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ color: '#1e3a5f', margin: '0 0 1.5rem', fontSize: '1.4rem' }}>Reschedule Booking #{id}</h1>

        {pageError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
            {pageError}
            <button onClick={() => setPageError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>✕</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* ── Current booking panel ── */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ color: '#1e3a5f', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid #f0f0f0', paddingBottom: '0.5rem' }}>
              Current booking
            </h2>
            {booking && (
              <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                <Row label="Turf"       value={booking.turf.turf_name} />
                <Row label="Sub-court"  value={booking.turf.sub_court_name} />
                <Row label="Date"       value={fmtDateLong(booking.booking_date)} />
                <Row label="Slots"      value={booking.slots.map(s => `${fmt12(s.start_time)}–${fmt12(s.end_time)}`).join(', ')} />
                <Row label="Total"      value={fmtMoney(booking.total_amount)} />
              </div>
            )}
            <button
              onClick={() => navigate(`/customer/bookings/${id}`)}
              style={{ marginTop: '1.25rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', padding: 0, textDecoration: 'underline' }}
            >
              ← Cancel reschedule
            </button>
          </div>

          {/* ── New booking panel ── */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ color: '#1e3a5f', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid #f0f0f0', paddingBottom: '0.5rem' }}>
              New booking
            </h2>

            {/* Date picker */}
            <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '0.9rem' }}>
              Date:
              <input
                type="date" value={date} min={todayISO()}
                onChange={e => setDate(e.target.value)}
                style={{ marginLeft: '0.5rem', padding: '0.35rem 0.55rem', borderRadius: '4px', border: '1px solid #d0d5dd', fontSize: '0.85rem' }}
              />
            </label>

            {/* Availability grid */}
            {loadingA && <div style={{ color: '#888', fontSize: '0.88rem', marginBottom: '0.75rem' }}>Loading availability…</div>}
            {!loadingA && <SlotGrid subCourt={subCourtAvail} selection={selection} onSlotClick={handleSlotClick} />}

            {/* Price diff summary */}
            {selection.slots.length > 0 && (
              <div style={{
                marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.88rem',
                background: priceDiff === 0 ? '#f0f9ff' : priceDiff < 0 ? '#f0fdf4' : '#fef3c7',
                color:      priceDiff === 0 ? '#0369a1' : priceDiff < 0 ? '#166534' : '#92400e',
                border: `1px solid ${priceDiff === 0 ? '#bae6fd' : priceDiff < 0 ? '#86efac' : '#fcd34d'}`,
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                  New total: {fmtMoney(newTotal)} ({selection.slots.length} slot{selection.slots.length !== 1 ? 's' : ''})
                </div>
                <div>
                  {priceDiff === 0 ? 'No price change.'
                    : priceDiff < 0 ? `You'll be refunded ${fmtMoney(Math.abs(priceDiff))}.`
                    : `Additional ${fmtMoney(priceDiff)} to pay.`}
                </div>
                {sameSlots && <div style={{ color: '#6b7280', marginTop: '0.25rem', fontSize: '0.82rem' }}>Same as current booking.</div>}
              </div>
            )}

            {/* Continue CTA */}
            <button
              onClick={handleContinue}
              disabled={!canContinue || initiating}
              style={{
                marginTop: '1rem', width: '100%', padding: '0.7rem',
                background: canContinue && !initiating ? '#1d4ed8' : '#e5e7eb',
                color: canContinue && !initiating ? '#fff' : '#9ca3af',
                border: 'none', borderRadius: '5px',
                cursor: canContinue && !initiating ? 'pointer' : 'not-allowed',
                fontWeight: 600, fontSize: '0.95rem',
              }}
            >
              {initiating ? 'Checking…' : 'Continue'}
            </button>
          </div>
        </div>
      </main>

      <ConfirmModal
        open={modalOpen}
        booking={booking}
        newDate={date}
        slots={selection.slots}
        priceDiff={priceDiff}
        initiateData={initiateData}
        onConfirm={handleConfirm}
        onCancel={() => { setModalOpen(false); setConfirmError(null); setConfirming(false); }}
        confirming={confirming}
        confirmError={confirmError}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.45rem', fontSize: '0.88rem' }}>
      <span style={{ color: '#9ca3af', minWidth: '80px' }}>{label}</span>
      <span style={{ color: '#374151', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
