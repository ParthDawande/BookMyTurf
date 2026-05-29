import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markOneRead, markAllRead } from '../api/notifications';
import Header from '../components/Header';
import CustomerNav from '../components/CustomerNav';

// ── Notification type → friendly label ───────────────────────────────────────

const NOTIF_LABELS = {
  BOOKING_CONFIRMED:   'Booking confirmed',
  BOOKING_CANCELLED:   'Booking cancelled',
  BOOKING_RESCHEDULED: 'Booking rescheduled',
  TURF_APPROVED:       'Turf approved',
  TURF_REJECTED:       'Turf rejected',
  COMPLAINT_ASSIGNED:  'Complaint assigned to you',
  PAYOUT_RELEASED:     'Payout released',
};

function notifLabel(type) {
  return NOTIF_LABELS[type] || type;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function ReadBadge({ isRead }) {
  return isRead ? null : (
    <span style={{
      display: 'inline-block', width: '8px', height: '8px',
      borderRadius: '50%', background: '#3b82f6', marginRight: '0.5rem', flexShrink: 0,
    }} />
  );
}

// ── NotificationsPage ─────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate();

  const [items,      setItems]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page,       setPage]       = useState(0); // 0-indexed per 8C
  const [isRead,     setIsRead]     = useState(null); // null=All, true=Read, false=Unread
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [marking,    setMarking]    = useState(false);

  const load = useCallback((pg, filter) => {
    setLoading(true);
    setError(null);
    const params = { page: pg, size: 20 };
    if (filter !== null) params.is_read = filter;
    listNotifications(params)
      .then(res => {
        setItems(res.data.notifications);
        setTotal(res.data.total_results);
        setTotalPages(res.data.total_pages);
      })
      .catch(() => setError('Failed to load notifications.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, isRead); }, [load, page, isRead]);

  async function handleMarkOne(id) {
    const item = items.find(n => n.id === id);
    if (!item || item.is_read) return;
    try {
      await markOneRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  }

  async function handleMarkAll() {
    setMarking(true);
    try {
      await markAllRead();
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
    finally { setMarking(false); }
  }

  const hasUnread = items.some(n => !n.is_read);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <CustomerNav />

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.35rem', fontWeight: 700 }}>Notifications</h1>
          {hasUnread && (
            <button onClick={handleMarkAll} disabled={marking} style={{
              padding: '0.45rem 1rem', background: '#fff', color: '#1d4ed8',
              border: '1px solid #93c5fd', borderRadius: '5px',
              cursor: marking ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
            }}>
              {marking ? 'Marking…' : 'Mark all as read'}
            </button>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {[['All', null], ['Unread', false], ['Read', true]].map(([label, val]) => (
            <button key={label} onClick={() => { setPage(0); setIsRead(val); }}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.82rem',
                fontWeight: isRead === val ? 600 : 400, cursor: 'pointer',
                background: isRead === val ? '#1d4ed8' : '#fff',
                color: isRead === val ? '#fff' : '#374151',
                border: `1px solid ${isRead === val ? '#1d4ed8' : '#d1d5db'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#888', padding: '3rem' }}>Loading…</div>}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔔</div>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>No notifications yet.</p>
          </div>
        )}

        {!loading && items.map(n => (
          <div
            key={n.id}
            onClick={() => handleMarkOne(n.id)}
            style={{
              background: '#fff', borderRadius: '10px', padding: '1rem 1.2rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '0.6rem',
              cursor: n.is_read ? 'default' : 'pointer',
              borderLeft: `3px solid ${n.is_read ? '#e5e7eb' : '#3b82f6'}`,
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
            }}
          >
            <ReadBadge isRead={n.is_read} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: n.is_read ? 400 : 600, color: '#1e3a5f', fontSize: '0.9rem' }}>
                  {notifLabel(n.type)}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '0.78rem', flexShrink: 0 }}>
                  {fmtDateTime(n.created_at)}
                </span>
              </div>
              {n.message && (
                <p style={{ margin: '0.2rem 0 0', color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  {n.message}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '0.4rem 0.9rem', background: '#fff', border: '1px solid #d1d5db',
                borderRadius: '5px', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
              ← Prev
            </button>
            <span style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#555' }}>
              {page + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ padding: '0.4rem 0.9rem', background: '#fff', border: '1px solid #d1d5db',
                borderRadius: '5px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
