import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getTurf, updateTurf, listPhotos, addPhoto, deletePhoto,
         createSubCourt, updateSubCourt, deleteSubCourt } from '../api/ownerTurfs';
import Header from '../components/Header';
import OwnerNav from '../components/OwnerNav';

// ── Shared constants ──────────────────────────────────────────────────────────

const COMMON_SPORTS = ['Football', 'Cricket', 'Badminton', 'Tennis', 'Basketball', 'Volleyball', 'Kabaddi', 'Hockey'];

const STATUS_CONFIG = {
  PENDING:  { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', msg: 'Pending admin review.' },
  APPROVED: { bg: '#dcfce7', color: '#166534', border: '#86efac', msg: 'Visible to customers.' },
  REJECTED: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', msg: 'Resubmit by editing and saving.' },
};

function StatusBadge({ status, large }) {
  const c = STATUS_CONFIG[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{ display: 'inline-block', padding: large ? '0.3rem 0.9rem' : '0.2rem 0.65rem',
      borderRadius: '999px', fontSize: large ? '0.88rem' : '0.75rem', fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

const inp = { padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '5px',
  fontSize: '0.9rem', boxSizing: 'border-box', width: '100%' };
const fld = { display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.85rem' };
const lbl = { fontSize: '0.83rem', fontWeight: 600, color: '#374151' };

// ── SportsSelector ────────────────────────────────────────────────────────────

function SportsSelector({ selected, onChange }) {
  const [custom, setCustom] = useState('');
  function toggle(s) { onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]); }
  function addCustom() {
    const t = custom.trim();
    if (t && !selected.includes(t)) onChange([...selected, t]);
    setCustom('');
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.4rem' }}>
        {COMMON_SPORTS.map(s => (
          <button key={s} type="button" onClick={() => toggle(s)} style={{
            padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.78rem', cursor: 'pointer',
            background: selected.includes(s) ? '#1d4ed8' : '#f3f4f6',
            color: selected.includes(s) ? '#fff' : '#374151',
            border: `1px solid ${selected.includes(s) ? '#1d4ed8' : '#d1d5db'}`,
          }}>
            {s}
          </button>
        ))}
        {selected.filter(s => !COMMON_SPORTS.includes(s)).map(s => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
            background: '#1d4ed8', color: '#fff', padding: '0.18rem 0.45rem', borderRadius: '999px', fontSize: '0.75rem' }}>
            {s}
            <button type="button" onClick={() => onChange(selected.filter(x => x !== s))}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.7rem' }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Custom sport…"
          style={{ padding: '0.25rem 0.55rem', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.78rem', flex: 1 }} />
        <button type="button" onClick={addCustom}
          style={{ padding: '0.25rem 0.6rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.78rem', cursor: 'pointer' }}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Sub-court modal (create / edit) ───────────────────────────────────────────

function SubCourtModal({ mode, initial, turfId, onSaved, onClose }) {
  const [form, setForm] = useState(initial || { name: '', sports: [], hourly_price: '', opening_hour: '07:00', closing_hour: '22:00' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.sports.length === 0) { setError('At least one sport is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name, sports: form.sports,
        hourly_price: Number(form.hourly_price),
        opening_hour: form.opening_hour, closing_hour: form.closing_hour,
      };
      let res;
      if (mode === 'create') {
        res = await createSubCourt(turfId, body);
      } else {
        res = await updateSubCourt(initial.sub_court_id, body);
      }
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save sub-court.');
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '520px', width: '95%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.05rem' }}>
          {mode === 'create' ? 'Add sub-court' : 'Edit sub-court'}
        </h3>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.55rem 0.8rem', borderRadius: '5px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={fld}>
            <label style={lbl}>Name <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required minLength={2} />
          </div>
          <div style={fld}>
            <label style={lbl}>Sports <span style={{ color: '#dc2626' }}>*</span></label>
            <SportsSelector selected={form.sports} onChange={v => setForm(f => ({ ...f, sports: v }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.7rem' }}>
            <div style={fld}>
              <label style={lbl}>Rate (₹/hr) <span style={{ color: '#dc2626' }}>*</span></label>
              <input style={inp} type="number" min="0.01" step="0.01" value={form.hourly_price}
                onChange={e => setForm(f => ({ ...f, hourly_price: e.target.value }))} required />
            </div>
            <div style={fld}>
              <label style={lbl}>Opens</label>
              <input style={inp} type="time" value={form.opening_hour}
                onChange={e => setForm(f => ({ ...f, opening_hour: e.target.value }))} required />
            </div>
            <div style={fld}>
              <label style={lbl}>Closes</label>
              <input style={inp} type="time" value={form.closing_hour}
                onChange={e => setForm(f => ({ ...f, closing_hour: e.target.value }))} required />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: '0.6rem', background: saving ? '#93c5fd' : '#1d4ed8',
              color: '#fff', border: 'none', borderRadius: '5px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600,
            }}>
              {saving ? 'Saving…' : (mode === 'create' ? 'Add sub-court' : 'Save changes')}
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

// ── Confirm delete modal ──────────────────────────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel, confirming }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '380px', width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#b91c1c', margin: '0 0 0.6rem', fontSize: '1rem' }}>{title}</h3>
        <p style={{ color: '#555', fontSize: '0.88rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={onConfirm} disabled={confirming} style={{
            flex: 1, padding: '0.6rem', background: confirming ? '#fca5a5' : '#dc2626',
            color: '#fff', border: 'none', borderRadius: '5px', cursor: confirming ? 'not-allowed' : 'pointer', fontWeight: 600,
          }}>
            {confirming ? 'Deleting…' : 'Delete'}
          </button>
          <button onClick={onCancel} style={{
            padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
            color: '#374151', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── OwnerTurfDetail ───────────────────────────────────────────────────────────

export default function OwnerTurfDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated = location.state?.created;

  const [turf,    setTurf]    = useState(null);
  const [photos,  setPhotos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Edit form state (mirrors turf fields)
  const [editForm, setEditForm] = useState(null);
  const [saving,   setSaving]  = useState(false);
  const [saveMsg,  setSaveMsg] = useState(null); // 'saved' | 'error'

  // Photo state
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [photoAdding, setPhotoAdding] = useState(false);
  const [photoDelId,  setPhotoDelId]  = useState(null); // photo_id to confirm-delete
  const [photoDeling, setPhotoDeling] = useState(false);

  // Sub-court state
  const [scModal,  setScModal]  = useState(null); // {mode:'create'|'edit', sc:null|obj}
  const [scDelId,  setScDelId]  = useState(null); // sub_court_id to confirm-delete
  const [scDeling, setScDeling] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTurf(id),
      listPhotos(id),
    ])
      .then(([tr, pr]) => {
        const t = tr.data;
        setTurf(t);
        setPhotos(pr.data);
        setEditForm({
          name: t.name, description: t.description || '',
          address: t.address, city: t.city, contact_phone: t.contact_phone,
        });
      })
      .catch(err => {
        if (err.response?.status === 404) setError('not_found');
        else setError('Failed to load turf.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Save turf ───────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await updateTurf(id, editForm);
      setTurf(prev => ({ ...prev, ...res.data }));
      setSaveMsg('saved');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setSaveMsg('error:' + (err.response?.data?.error || 'Save failed.'));
    } finally {
      setSaving(false);
    }
  }

  // ── Photos ──────────────────────────────────────────────────────────────────
  async function handleAddPhoto(e) {
    e.preventDefault();
    const url = newPhotoUrl.trim();
    if (!url) return;
    setPhotoAdding(true);
    try {
      const res = await addPhoto(id, { photo_url: url });
      setPhotos(prev => [...prev, res.data]);
      setNewPhotoUrl('');
    } catch { /* ignore */ }
    finally { setPhotoAdding(false); }
  }

  async function handleDeletePhoto() {
    setPhotoDeling(true);
    try {
      await deletePhoto(id, photoDelId);
      setPhotos(prev => prev.filter(p => p.photo_id !== photoDelId));
      setPhotoDelId(null);
    } catch { /* ignore */ }
    finally { setPhotoDeling(false); }
  }

  // ── Sub-courts ──────────────────────────────────────────────────────────────
  function handleScSaved(savedSc) {
    if (scModal.mode === 'create') {
      setTurf(prev => ({ ...prev, sub_courts: [...(prev.sub_courts || []), savedSc] }));
    } else {
      setTurf(prev => ({
        ...prev,
        sub_courts: (prev.sub_courts || []).map(s => s.sub_court_id === savedSc.sub_court_id ? { ...s, ...savedSc } : s),
      }));
    }
    setScModal(null);
  }

  async function handleDeleteSc() {
    setScDeling(true);
    try {
      await deleteSubCourt(scDelId);
      setTurf(prev => ({ ...prev, sub_courts: (prev.sub_courts || []).filter(s => s.sub_court_id !== scDelId) }));
      setScDelId(null);
    } catch { /* ignore */ }
    finally { setScDeling(false); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}><Header /><OwnerNav />
      <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>Loading…</div>
    </div>
  );

  if (error === 'not_found') return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}><Header /><OwnerNav />
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>❌</div>
        <p style={{ color: '#555', marginBottom: '1rem' }}>Turf not found.</p>
        <button onClick={() => navigate('/owner/turfs')}
          style={{ color: '#2e86de', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          ← My Turfs
        </button>
      </main>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}><Header /><OwnerNav />
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#555' }}>{error}</p>
      </main>
    </div>
  );

  const coverPhoto = photos[0]?.photo_url || turf.photos?.[0];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <OwnerNav />

      {/* Modals */}
      {scModal && (
        <SubCourtModal
          mode={scModal.mode}
          initial={scModal.mode === 'edit' ? scModal.sc : null}
          turfId={id}
          onSaved={handleScSaved}
          onClose={() => setScModal(null)}
        />
      )}
      {photoDelId !== null && (
        <ConfirmModal
          title="Delete photo?"
          message="This photo will be permanently removed."
          onConfirm={handleDeletePhoto}
          onCancel={() => setPhotoDelId(null)}
          confirming={photoDeling}
        />
      )}
      {scDelId !== null && (
        <ConfirmModal
          title="Delete sub-court?"
          message="This cannot be undone. Sub-courts with confirmed bookings cannot be deleted."
          onConfirm={handleDeleteSc}
          onCancel={() => setScDelId(null)}
          confirming={scDeling}
        />
      )}

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <button onClick={() => navigate('/owner/turfs')}
          style={{ background: 'none', border: 'none', color: '#2e86de', cursor: 'pointer', fontSize: '0.88rem', padding: 0, marginBottom: '1rem' }}>
          ← My Turfs
        </button>

        {/* Just-created banner */}
        {justCreated && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534',
            padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
            ✅ Turf created. It will be reviewed by an admin and visible to customers once approved.
          </div>
        )}

        {/* Turf header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>{turf.name}</h1>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <StatusBadge status={turf.status} large />
            <span style={{ fontSize: '0.8rem', color: STATUS_CONFIG[turf.status]?.color || '#6b7280' }}>
              {STATUS_CONFIG[turf.status]?.msg}
            </span>
          </div>
        </div>

        {/* Cover photo */}
        <div style={{ background: '#e5e7eb', borderRadius: '10px', height: '200px', marginBottom: '1.25rem',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {coverPhoto
            ? <img src={coverPhoto} alt={turf.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; }} />
            : <div style={{ color: '#9ca3af', fontSize: '2.5rem' }}>🏟️</div>
          }
        </div>

        {/* Edit form */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#1e3a5f', fontSize: '0.95rem', fontWeight: 600 }}>
            Turf details
          </h3>

          {turf.status === 'APPROVED' && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e',
              padding: '0.6rem 0.9rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.82rem' }}>
              ⚠ Saving changes will reset this turf's status to PENDING for admin re-approval.
              All fields are editable.
            </div>
          )}

          {editForm && (
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div style={fld}>
                  <label style={lbl}>Name</label>
                  <input style={inp} value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required minLength={5} />
                </div>
                <div style={fld}>
                  <label style={lbl}>City</label>
                  <input style={inp} value={editForm.city}
                    onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} required minLength={2} />
                </div>
              </div>
              <div style={fld}>
                <label style={lbl}>Address</label>
                <input style={inp} value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} required minLength={5} />
              </div>
              <div style={fld}>
                <label style={lbl}>Contact phone</label>
                <input style={inp} value={editForm.contact_phone}
                  onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))}
                  pattern="[0-9]{10}" />
              </div>
              <div style={fld}>
                <label style={lbl}>Description</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} maxLength={2000} />
              </div>

              {saveMsg === 'saved' && (
                <div style={{ color: '#166534', fontSize: '0.85rem', marginBottom: '0.5rem' }}>✅ Saved.</div>
              )}
              {saveMsg?.startsWith('error:') && (
                <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  {saveMsg.slice(6)}
                </div>
              )}

              <button type="submit" disabled={saving} style={{
                padding: '0.55rem 1.5rem', background: saving ? '#93c5fd' : '#1d4ed8',
                color: '#fff', border: 'none', borderRadius: '5px',
                cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
              }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          )}
        </div>

        {/* Photos section */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.85rem', color: '#1e3a5f', fontSize: '0.95rem', fontWeight: 600 }}>
            Photos {photos.length > 0 && <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.8rem' }}>
              (first photo is the cover)
            </span>}
          </h3>

          {/* Gallery */}
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {photos.map(p => (
                <div key={p.photo_id} style={{ position: 'relative' }}>
                  <img src={p.photo_url} alt="" style={{ width: '100px', height: '70px', objectFit: 'cover',
                    borderRadius: '6px', border: '1px solid #e5e7eb' }}
                    onError={e => { e.target.src = ''; e.target.style.background = '#e5e7eb'; }} />
                  <button onClick={() => setPhotoDelId(p.photo_id)} style={{
                    position: 'absolute', top: '-6px', right: '-6px', background: '#dc2626',
                    color: '#fff', border: 'none', borderRadius: '999px', width: '18px', height: '18px',
                    cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Add photo URL */}
          <form onSubmit={handleAddPhoto} style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="url" value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              style={{ ...inp, flex: 1 }} />
            <button type="submit" disabled={photoAdding || !newPhotoUrl.trim()} style={{
              padding: '0.45rem 1rem', background: photoAdding ? '#93c5fd' : '#1d4ed8',
              color: '#fff', border: 'none', borderRadius: '5px',
              cursor: photoAdding ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap',
            }}>
              {photoAdding ? 'Adding…' : 'Add photo'}
            </button>
          </form>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.35rem' }}>
            Enter an image URL. In production, photos would be uploaded to cloud storage first.
          </div>
        </div>

        {/* Sub-courts section */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#1e3a5f', fontSize: '0.95rem', fontWeight: 600 }}>
              Sub-courts ({(turf.sub_courts || []).length})
            </h3>
            <button onClick={() => setScModal({ mode: 'create' })} style={{
              padding: '0.4rem 0.9rem', background: '#1d4ed8', color: '#fff',
              border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
            }}>
              + Add sub-court
            </button>
          </div>

          {(turf.sub_courts || []).length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: '0.88rem', margin: 0 }}>No sub-courts yet.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(turf.sub_courts || []).map(sc => (
              <div key={sc.sub_court_id} style={{ background: '#f9fafb', borderRadius: '8px',
                padding: '0.9rem 1rem', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e3a5f', marginBottom: '0.2rem' }}>{sc.name}</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                      {sc.sports?.join(', ')} · ₹{sc.hourly_price}/hr · {sc.opening_hour}–{sc.closing_hour}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px',
                      fontSize: '0.72rem', fontWeight: 600,
                      background: STATUS_CONFIG[sc.status]?.bg || '#f3f4f6',
                      color: STATUS_CONFIG[sc.status]?.color || '#374151' }}>
                      {sc.status}
                    </span>
                    <button onClick={() => setScModal({ mode: 'edit', sc: { ...sc, hourly_price: sc.hourly_price } })} style={{
                      padding: '0.25rem 0.6rem', background: '#fff', border: '1px solid #d1d5db',
                      borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', color: '#374151',
                    }}>
                      Edit
                    </button>
                    <button onClick={() => setScDelId(sc.sub_court_id)} style={{
                      padding: '0.25rem 0.6rem', background: '#fee2e2', border: '1px solid #fca5a5',
                      borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', color: '#dc2626',
                    }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
