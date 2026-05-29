import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { listOwnerReviews, postReply, putReply, deleteReply } from '../api/ownerTurfs';
import Header from '../components/Header';
import OwnerNav from '../components/OwnerNav';

function Stars({ rating }) {
  const r = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span style={{ color: '#f59e0b', fontSize: '0.95rem', letterSpacing: '0.04em' }}>
      {'★'.repeat(r)}{'☆'.repeat(5 - r)}
    </span>
  );
}

function fmtDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function ConfirmDeleteModal({ onConfirm, onCancel, deleting }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }} onClick={onCancel}>
      <div style={{
        background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '380px', width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#b91c1c', margin: '0 0 0.6rem', fontSize: '1rem' }}>Delete your reply?</h3>
        <p style={{ color: '#555', fontSize: '0.88rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          The review will appear unreplied to customers.
        </p>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={onConfirm} disabled={deleting} style={{
            flex: 1, padding: '0.6rem',
            background: deleting ? '#fca5a5' : '#dc2626',
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: deleting ? 'not-allowed' : 'pointer', fontWeight: 600,
          }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button onClick={onCancel} style={{
            padding: '0.6rem 1rem', background: 'transparent',
            border: '1px solid #d1d5db', color: '#374151',
            borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline reply form ─────────────────────────────────────────────────────────

function ReplyForm({ mode, initial, onSubmit, onCancel, saving, error }) {
  const [text, setText] = useState(initial || '');

  function handleSubmit() {
    if (text.trim()) onSubmit(text.trim());
  }

  return (
    <div style={{ marginTop: '0.6rem' }}>
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
          padding: '0.4rem 0.7rem', borderRadius: '5px', marginBottom: '0.5rem', fontSize: '0.82rem',
        }}>
          {error}
        </div>
      )}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write your reply…"
        rows={3}
        style={{
          width: '100%', padding: '0.5rem 0.7rem',
          border: '1px solid #d1d5db', borderRadius: '5px',
          fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !text.trim()}
          style={{
            padding: '0.4rem 1rem',
            background: saving ? '#93c5fd' : '#1d4ed8',
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: saving || !text.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: '0.85rem',
          }}>
          {saving ? 'Saving…' : (mode === 'edit' ? 'Save changes' : 'Post reply')}
        </button>
        <button onClick={onCancel} style={{
          padding: '0.4rem 0.9rem', background: 'transparent',
          border: '1px solid #d1d5db', color: '#374151',
          borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── OwnerReviews ──────────────────────────────────────────────────────────────

export default function OwnerReviews() {
  const [searchParams, setSearchParams] = useSearchParams();

  const repliedParam = searchParams.get('replied'); // null | 'true' | 'false'
  const pageParam    = parseInt(searchParams.get('page') || '1', 10);

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Active reply form: { reviewId, mode:'create'|'edit', initialText, saving, error }
  const [activeReply, setActiveReply] = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);
  const [deleting,    setDeleting]    = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page: pageParam };
    if (repliedParam !== null) params.replied = repliedParam;
    listOwnerReviews(params)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load reviews.'))
      .finally(() => setLoading(false));
  }, [repliedParam, pageParam]);

  useEffect(() => { load(); }, [load]);

  function setFilter(val) {
    const p = {};
    if (val !== null) p.replied = val;
    setSearchParams(p); // resets page to 1
  }

  function setPage(n) {
    const p = Object.fromEntries(searchParams);
    p.page = String(n);
    setSearchParams(p);
  }

  async function handleReplySubmit(reviewId, mode, text) {
    setActiveReply(r => ({ ...r, saving: true, error: null }));
    try {
      if (mode === 'create') {
        await postReply(reviewId, { reply_text: text });
      } else {
        await putReply(reviewId, { reply_text: text });
      }
      setActiveReply(null);
      load();
    } catch (err) {
      setActiveReply(r => ({
        ...r, saving: false,
        error: err.response?.data?.error || 'Failed to save reply.',
      }));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteReply(deleteId);
      setDeleteId(null);
      load();
    } catch {
      /* silently re-enable the button */
    } finally {
      setDeleting(false);
    }
  }

  const summary = data?.summary;
  const reviews = data?.reviews || [];
  const unrepliedCount = summary?.unreplied_count ?? 0;

  const FILTERS = [
    { label: 'All', value: null },
    { label: unrepliedCount > 0 ? `Unreplied (${unrepliedCount})` : 'Unreplied', value: 'false' },
    { label: 'Replied', value: 'true' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <OwnerNav />

      {deleteId !== null && (
        <ConfirmDeleteModal
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
          deleting={deleting}
        />
      )}

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
          Reviews
        </h1>

        {/* Summary card */}
        {summary && (
          <div style={{
            background: '#fff', borderRadius: '10px', padding: '1.1rem 1.5rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.25rem',
            display: 'flex', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e3a5f', lineHeight: 1 }}>
                {summary.avg_rating ? Number(summary.avg_rating).toFixed(1) : '—'}
              </div>
              {summary.avg_rating > 0 && (
                <div style={{ marginTop: '0.2rem' }}>
                  <Stars rating={summary.avg_rating} />
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>Avg Rating</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e3a5f', lineHeight: 1 }}>
                {summary.review_count}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>Total Reviews</div>
            </div>
            {unrepliedCount > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#92400e', lineHeight: 1 }}>
                  {unrepliedCount}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>Awaiting Reply</div>
              </div>
            )}
          </div>
        )}

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {FILTERS.map(({ label, value }) => {
            const active = repliedParam === value || (value === null && repliedParam === null);
            return (
              <button key={label} onClick={() => setFilter(value)} style={{
                padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.83rem',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
                background: active ? '#1d4ed8' : '#fff',
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? '#1d4ed8' : '#d1d5db'}`,
              }}>
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: '130px', borderRadius: '10px',
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                backgroundSize: '200% 100%',
              }} />
            ))}
          </div>
        )}

        {!loading && !error && reviews.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: '10px', padding: '3rem 2rem', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⭐</div>
            <p style={{ color: '#6b7280', margin: '0 auto', lineHeight: 1.6, maxWidth: '340px' }}>
              {repliedParam === 'false'
                ? 'All reviews have been replied to.'
                : repliedParam === 'true'
                  ? 'No replied reviews yet.'
                  : "No reviews yet — once customers review your turfs, they'll appear here."}
            </p>
          </div>
        )}

        {/* Review cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {reviews.map(review => {
            const isActive = activeReply?.reviewId === review.review_id;

            return (
              <div key={review.review_id} style={{
                background: '#fff', borderRadius: '10px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '1.25rem 1.4rem',
              }}>
                {/* Review header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.6rem',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#1e3a5f', fontSize: '0.93rem' }}>
                      {review.customer_name}
                    </span>
                    <span style={{ margin: '0 0.5rem', color: '#e5e7eb' }}>·</span>
                    <Stars rating={review.rating} />
                    <span style={{ marginLeft: '0.35rem', fontSize: '0.78rem', color: '#9ca3af' }}>
                      {fmtDate(review.created_at)}
                    </span>
                  </div>
                  <Link
                    to={`/owner/turfs/${review.turf_id}`}
                    style={{ fontSize: '0.78rem', color: '#1d4ed8', textDecoration: 'none', flexShrink: 0 }}>
                    {review.turf_name} ↗
                  </Link>
                </div>

                {/* Review text */}
                {review.review_text && (
                  <p style={{ margin: '0 0 0.9rem', color: '#374151', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {review.review_text}
                  </p>
                )}

                {/* Existing reply */}
                {review.owner_reply && !isActive && (
                  <div style={{
                    background: '#f0f9ff', border: '1px solid #bae6fd',
                    borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '0.5rem',
                  }}>
                    <div style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Your reply · {fmtDate(review.owner_reply.created_at)}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#374151', lineHeight: 1.55 }}>
                      {review.owner_reply.reply_text}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                      <button
                        onClick={() => setActiveReply({
                          reviewId: review.review_id, mode: 'edit',
                          initialText: review.owner_reply.reply_text,
                          saving: false, error: null,
                        })}
                        style={{
                          padding: '0.2rem 0.6rem', background: '#fff',
                          border: '1px solid #bae6fd', borderRadius: '4px',
                          cursor: 'pointer', fontSize: '0.78rem', color: '#0369a1',
                        }}>
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(review.review_id)}
                        style={{
                          padding: '0.2rem 0.6rem', background: '#fff',
                          border: '1px solid #fca5a5', borderRadius: '4px',
                          cursor: 'pointer', fontSize: '0.78rem', color: '#dc2626',
                        }}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {/* No reply — reply button */}
                {!review.owner_reply && !isActive && (
                  <button
                    onClick={() => setActiveReply({
                      reviewId: review.review_id, mode: 'create',
                      initialText: '', saving: false, error: null,
                    })}
                    style={{
                      padding: '0.3rem 0.8rem', background: 'transparent',
                      border: '1px solid #d1d5db', borderRadius: '5px',
                      cursor: 'pointer', fontSize: '0.82rem', color: '#374151',
                    }}>
                    Reply to this review
                  </button>
                )}

                {/* Inline reply form */}
                {isActive && (
                  <ReplyForm
                    mode={activeReply.mode}
                    initial={activeReply.initialText}
                    saving={activeReply.saving}
                    error={activeReply.error}
                    onSubmit={text => handleReplySubmit(review.review_id, activeReply.mode, text)}
                    onCancel={() => setActiveReply(null)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '0.5rem',
            marginTop: '1rem', alignItems: 'center',
          }}>
            <button
              disabled={pageParam <= 1}
              onClick={() => setPage(pageParam - 1)}
              style={{
                padding: '0.4rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '5px',
                background: pageParam <= 1 ? '#f9fafb' : '#fff',
                cursor: pageParam <= 1 ? 'not-allowed' : 'pointer',
                color: pageParam <= 1 ? '#9ca3af' : '#374151', fontSize: '0.88rem',
              }}>
              ← Prev
            </button>
            <span style={{ fontSize: '0.85rem', color: '#6b7280', padding: '0 0.25rem' }}>
              Page {data.page} of {data.total_pages} ({data.total_results} review{data.total_results !== 1 ? 's' : ''})
            </span>
            <button
              disabled={pageParam >= data.total_pages}
              onClick={() => setPage(pageParam + 1)}
              style={{
                padding: '0.4rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '5px',
                background: pageParam >= data.total_pages ? '#f9fafb' : '#fff',
                cursor: pageParam >= data.total_pages ? 'not-allowed' : 'pointer',
                color: pageParam >= data.total_pages ? '#9ca3af' : '#374151', fontSize: '0.88rem',
              }}>
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
