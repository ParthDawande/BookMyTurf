import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getCustomerTurfDetail, getCustomerAvailability } from '../api/turfs';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// API returns snake_case: avg_rating, review_count
function RatingBadge({ avg_rating, review_count }) {
  if (!review_count || review_count === 0) {
    return <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No ratings yet</span>;
  }
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

// Null-safe cover photo — SVG placeholder when url is null (6A carried-forward rule)
function CoverPhoto({ url, name, height = 280 }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: '100%', height, objectFit: 'cover', borderRadius: '8px', display: 'block' }}
      />
    );
  }
  return (
    <div
      aria-label={`${name} — no cover photo`}
      style={{
        width: '100%',
        height,
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2e86de 100%)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        gap: '0.5rem',
      }}
    >
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

// ── SlotGrid ─────────────────────────────────────────────────────────────────
// Availability response: sub_courts[].slots[].{start_time, end_time, available}

function SlotGrid({ subCourts, onSlotClick }) {
  if (!subCourts?.length) {
    return <p style={{ color: '#888' }}>No availability data.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {subCourts.map(sc => (
        <div key={sc.sub_court_id} style={{
          background: '#fff',
          borderRadius: '8px',
          padding: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
            <strong style={{ color: '#1e3a5f', fontSize: '0.95rem' }}>{sc.name}</strong>
            <span style={{ color: '#555', fontSize: '0.8rem' }}>
              ₹{Number(sc.hourly_price).toLocaleString()}/hr · {sc.opening_hour}–{sc.closing_hour}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {sc.slots?.map(slot => (
              <button
                key={slot.start_time}
                disabled={!slot.available}
                onClick={() => slot.available && onSlotClick({ sc, slot })}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  fontSize: '0.78rem',
                  cursor: slot.available ? 'pointer' : 'not-allowed',
                  background: slot.available ? '#ecfdf5' : '#f9fafb',
                  borderColor: slot.available ? '#6ee7b7' : '#e5e7eb',
                  color: slot.available ? '#065f46' : '#9ca3af',
                  fontWeight: slot.available ? 500 : 400,
                }}
              >
                {slot.start_time}–{slot.end_time}
                {!slot.available && ' · Taken'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ReviewsSection ────────────────────────────────────────────────────────────
// Detail response: recent_reviews[].{review_id, customer_name, rating, review_text, created_at, owner_reply}

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
              background: '#fff',
              borderRadius: '8px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
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
                <div style={{
                  marginLeft: '1rem',
                  paddingLeft: '0.75rem',
                  borderLeft: '2px solid #2e86de',
                  marginTop: '0.5rem',
                }}>
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

// ── Slot modal — "Continue to booking" placeholder ───────────────────────────

function SlotModal({ slotInfo, onClose }) {
  if (!slotInfo) return null;
  const { sc, slot } = slotInfo;
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: '10px', padding: '2rem',
          maxWidth: '400px', width: '90%', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ color: '#1e3a5f', margin: '0 0 0.25rem' }}>{sc.name}</h3>
        <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {slot.start_time} – {slot.end_time}
        </p>
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          color: '#0369a1',
          fontSize: '0.9rem',
        }}>
          Continue to booking — coming in the next sub-phase.
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '0.5rem 1.4rem',
            background: '#2e86de',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── TurfDetail (main export) ──────────────────────────────────────────────────

export default function TurfDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { isAuthenticated, hasRole } = useAuth();

  // Must be logged in AND have the CUSTOMER role to call /api/customer/**
  const isCustomer = isAuthenticated && hasRole('CUSTOMER');

  // Basic info passed from list navigation (snake_case from API)
  const listTurf = location.state?.turf;

  const [detail,      setDetail]      = useState(null);
  const [loadingD,    setLoadingD]    = useState(false);
  const [errorD,      setErrorD]      = useState(null);

  const [date,        setDate]        = useState(todayISO);
  const [avail,       setAvail]       = useState(null);
  const [loadingA,    setLoadingA]    = useState(false);
  const [errorA,      setErrorA]      = useState(null);

  const [clickedSlot, setClickedSlot] = useState(null);

  // Fetch full detail — only for authenticated customers
  // BACKEND NOTE: /api/customer/** requires CUSTOMER role (SecurityConfig).
  // /api/public/turfs/{id} does NOT exist — no public detail endpoint.
  // Anonymous visitors see the auth gate below instead of full content.
  useEffect(() => {
    if (!isCustomer) return;
    setLoadingD(true);
    setErrorD(null);
    getCustomerTurfDetail(id)
      .then(res => setDetail(res.data))
      .catch(err => setErrorD(err.response?.data?.error || "Couldn't load turf details."))
      .finally(() => setLoadingD(false));
  }, [id, isCustomer]);

  // Fetch availability whenever date changes — only for authenticated customers
  useEffect(() => {
    if (!isCustomer) return;
    setLoadingA(true);
    setErrorA(null);
    setAvail(null);
    getCustomerAvailability(id, date)
      .then(res => setAvail(res.data))
      .catch(err => setErrorA(err.response?.data?.error || "Couldn't load availability."))
      .finally(() => setLoadingA(false));
  }, [id, date, isCustomer]);

  // Hero: use full detail once loaded; fall back to list-card data from navigation state.
  // Both use snake_case field names from the API.
  const hero = detail || listTurf;
  // Cover: detail page uses photos[0]; list card has cover_photo_url
  const coverUrl = detail ? (detail.photos?.[0] ?? null) : (listTurf?.cover_photo_url ?? null);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: '#2e86de',
            cursor: 'pointer', fontSize: '0.88rem', padding: 0, marginBottom: '1rem',
            display: 'flex', alignItems: 'center', gap: '0.25rem',
          }}
        >
          ← Back
        </button>

        {/* ── Hero ── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <CoverPhoto url={coverUrl} name={hero?.name || 'Turf'} height={280} />
          {hero && (
            <div style={{ marginTop: '1rem' }}>
              <h1 style={{ margin: '0 0 0.2rem', color: '#1e3a5f', fontSize: '1.6rem', fontWeight: 700 }}>
                {hero.name}
              </h1>
              <p style={{ margin: '0 0 0.4rem', color: '#666', fontSize: '0.9rem' }}>
                {hero.city}{hero.address ? ` · ${hero.address}` : ''}
              </p>
              <RatingBadge avg_rating={hero.avg_rating} review_count={hero.review_count} />
              {hero.description && (
                <p style={{ marginTop: '0.75rem', color: '#555', lineHeight: 1.65, fontSize: '0.92rem' }}>
                  {hero.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Auth gate — anonymous / non-customer visitors ── */}
        {!isCustomer && (
          <div style={{
            background: '#fff',
            borderRadius: '10px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
            <h2 style={{ color: '#1e3a5f', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
              Sign in to book
            </h2>
            <p style={{ color: '#666', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto 1.25rem' }}>
              Sign in as a customer to view sub-courts, check slot availability, and read reviews.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '0.55rem 1.4rem',
                  background: '#2e86de',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                }}
              >
                Sign in
              </button>
              <button
                onClick={() => navigate('/register')}
                style={{
                  padding: '0.55rem 1.4rem',
                  background: 'transparent',
                  border: '1px solid #2e86de',
                  color: '#2e86de',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Register
              </button>
            </div>
          </div>
        )}

        {/* ── Full detail — authenticated CUSTOMER only ── */}
        {isCustomer && (
          <>
            {loadingD && <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Loading…</div>}
            {errorD && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fca5a5',
                color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginBottom: '1rem',
              }}>
                {errorD}
              </div>
            )}

            {detail && (
              <>
                {/* Sub-courts — response: sub_courts[].{sub_court_id, name, sports, hourly_price, opening_hour, closing_hour} */}
                <section style={{ marginBottom: '2rem' }}>
                  <h2 style={{ color: '#1e3a5f', marginBottom: '1rem', fontSize: '1.2rem' }}>Sub-courts</h2>
                  {!detail.sub_courts?.length ? (
                    <p style={{ color: '#888' }}>No sub-courts listed.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {detail.sub_courts.map(sc => (
                        <div key={sc.sub_court_id} style={{
                          background: '#fff',
                          borderRadius: '8px',
                          padding: '1rem',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          alignItems: 'center',
                          justifyContent: 'space-between',
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

                {/* Availability checker — response: sub_courts[].slots[].{start_time, end_time, available} */}
                <section style={{ marginBottom: '2rem' }}>
                  <h2 style={{ color: '#1e3a5f', marginBottom: '1rem', fontSize: '1.2rem' }}>Check Availability</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <label style={{ color: '#555', fontSize: '0.9rem' }}>
                      Date:
                      <input
                        type="date"
                        value={date}
                        min={todayISO()}
                        onChange={e => setDate(e.target.value)}
                        style={{
                          marginLeft: '0.5rem',
                          padding: '0.35rem 0.55rem',
                          borderRadius: '4px',
                          border: '1px solid #d0d5dd',
                          fontSize: '0.85rem',
                        }}
                      />
                    </label>
                  </div>

                  {loadingA && <div style={{ color: '#888', fontSize: '0.9rem' }}>Loading availability…</div>}
                  {errorA && <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{errorA}</div>}
                  {avail && (
                    <SlotGrid
                      subCourts={avail.sub_courts}
                      onSlotClick={setClickedSlot}
                    />
                  )}
                </section>

                {/* Reviews — response: recent_reviews[].{review_id, customer_name, rating, review_text, created_at, owner_reply} */}
                <ReviewsSection reviews={detail.recent_reviews} />
              </>
            )}
          </>
        )}
      </main>

      {/* Slot click modal — "Continue to booking" placeholder */}
      <SlotModal slotInfo={clickedSlot} onClose={() => setClickedSlot(null)} />
    </div>
  );
}
