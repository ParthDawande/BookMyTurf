import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTurf } from '../api/ownerTurfs';
import Header from '../components/Header';
import OwnerNav from '../components/OwnerNav';

const COMMON_SPORTS = ['Football', 'Cricket', 'Badminton', 'Tennis', 'Basketball', 'Volleyball', 'Kabaddi', 'Hockey'];

const BLANK_SC = () => ({
  name: '', sports: [], hourly_price: '', opening_hour: '07:00', closing_hour: '22:00',
});

function SportsSelector({ selected, onChange }) {
  const [custom, setCustom] = useState('');
  function toggle(s) {
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]);
  }
  function addCustom() {
    const t = custom.trim();
    if (t && !selected.includes(t)) onChange([...selected, t]);
    setCustom('');
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {COMMON_SPORTS.map(s => (
          <button key={s} type="button" onClick={() => toggle(s)} style={{
            padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer',
            background: selected.includes(s) ? '#1d4ed8' : '#f3f4f6',
            color: selected.includes(s) ? '#fff' : '#374151',
            border: `1px solid ${selected.includes(s) ? '#1d4ed8' : '#d1d5db'}`,
            fontWeight: selected.includes(s) ? 600 : 400,
          }}>
            {s}
          </button>
        ))}
      </div>
      {selected.filter(s => !COMMON_SPORTS.includes(s)).map(s => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
          background: '#1d4ed8', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '999px',
          fontSize: '0.78rem', marginRight: '0.3rem', marginBottom: '0.3rem' }}>
          {s}
          <button type="button" onClick={() => onChange(selected.filter(x => x !== s))}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
        </span>
      ))}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Custom sport…"
          style={{ padding: '0.3rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.82rem', flex: 1 }} />
        <button type="button" onClick={addCustom}
          style={{ padding: '0.3rem 0.7rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.82rem', cursor: 'pointer' }}>
          Add
        </button>
      </div>
    </div>
  );
}

const fld = { display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' };
const lbl = { fontSize: '0.85rem', fontWeight: 600, color: '#374151' };
const inp = { padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.9rem', boxSizing: 'border-box', width: '100%' };

export default function OwnerTurfNew() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', description: '', address: '', city: '', contact_phone: '',
  });
  const [photoUrls, setPhotoUrls] = useState(['']);
  const [subCourts, setSubCourts] = useState([BLANK_SC()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // Photo URL management
  function setPhotoUrl(i, v) { setPhotoUrls(prev => prev.map((u, idx) => idx === i ? v : u)); }
  function addPhotoUrl() { setPhotoUrls(p => [...p, '']); }
  function removePhotoUrl(i) { setPhotoUrls(p => p.filter((_, idx) => idx !== i)); }

  // Sub-court management
  function setSCField(i, k, v) {
    setSubCourts(prev => prev.map((sc, idx) => idx === i ? { ...sc, [k]: v } : sc));
  }
  function addSC() { setSubCourts(p => [...p, BLANK_SC()]); }
  function removeSC(i) { setSubCourts(p => p.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e) {
    e.preventDefault();
    const photos = photoUrls.map(u => u.trim()).filter(Boolean);
    if (photos.length === 0) { setError('At least one photo URL is required.'); return; }
    for (const sc of subCourts) {
      if (sc.sports.length === 0) { setError('Each sub-court needs at least one sport.'); return; }
    }

    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: form.name, description: form.description || undefined,
        address: form.address, city: form.city, contact_phone: form.contact_phone,
        photos,
        sub_courts: subCourts.map(sc => ({
          name: sc.name, sports: sc.sports,
          hourly_price: Number(sc.hourly_price),
          opening_hour: sc.opening_hour, closing_hour: sc.closing_hour,
        })),
      };
      const res = await createTurf(body);
      navigate(`/owner/turfs/${res.data.turf_id}`, { state: { created: true } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create turf. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <OwnerNav />
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <button onClick={() => navigate('/owner/turfs')}
          style={{ background: 'none', border: 'none', color: '#2e86de', cursor: 'pointer', fontSize: '0.88rem', padding: 0, marginBottom: '1rem' }}>
          ← My Turfs
        </button>

        <h1 style={{ margin: '0 0 1.5rem', color: '#1e3a5f', fontSize: '1.35rem', fontWeight: 700 }}>
          Add a turf
        </h1>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#1e3a5f', fontSize: '0.95rem', fontWeight: 600 }}>Turf details</h3>
            <div style={fld}>
              <label style={lbl}>Turf name <span style={{ color: '#dc2626' }}>*</span></label>
              <input style={inp} value={form.name} onChange={e => setField('name', e.target.value)} required minLength={5} maxLength={150} />
            </div>
            <div style={fld}>
              <label style={lbl}>Description</label>
              <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={form.description}
                onChange={e => setField('description', e.target.value)} maxLength={2000} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div style={fld}>
                <label style={lbl}>Address <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={inp} value={form.address} onChange={e => setField('address', e.target.value)} required minLength={5} />
              </div>
              <div style={fld}>
                <label style={lbl}>City <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={inp} value={form.city} onChange={e => setField('city', e.target.value)} required minLength={2} />
              </div>
            </div>
            <div style={fld}>
              <label style={lbl}>Contact phone <span style={{ color: '#dc2626' }}>*</span></label>
              <input style={inp} value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)}
                required pattern="[0-9]{10}" placeholder="10-digit number" />
            </div>
          </div>

          {/* Photos */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: '#1e3a5f', fontSize: '0.95rem', fontWeight: 600 }}>
              Photos <span style={{ color: '#dc2626', fontWeight: 400, fontSize: '0.82rem' }}>* at least one URL required</span>
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
              Enter image URLs. The first URL will be used as the cover photo.
            </div>
            {photoUrls.map((url, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input style={{ ...inp, flex: 1 }} type="url" value={url}
                  onChange={e => setPhotoUrl(i, e.target.value)}
                  placeholder="https://example.com/photo.jpg" />
                {photoUrls.length > 1 && (
                  <button type="button" onClick={() => removePhotoUrl(i)} style={{
                    padding: '0 0.7rem', background: '#fee2e2', color: '#dc2626',
                    border: '1px solid #fca5a5', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem',
                  }}>✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addPhotoUrl} style={{
              padding: '0.35rem 0.9rem', background: '#f3f4f6', border: '1px solid #d1d5db',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', color: '#374151',
            }}>
              + Add another URL
            </button>
          </div>

          {/* Sub-courts */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: '#1e3a5f', fontSize: '0.95rem', fontWeight: 600 }}>
              Sub-courts <span style={{ color: '#dc2626', fontWeight: 400, fontSize: '0.82rem' }}>* at least one required</span>
            </h3>

            {subCourts.map((sc, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.88rem' }}>Sub-court {i + 1}</span>
                  {subCourts.length > 1 && (
                    <button type="button" onClick={() => removeSC(i)} style={{
                      background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
                      borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem',
                    }}>Remove</button>
                  )}
                </div>
                <div style={fld}>
                  <label style={lbl}>Name <span style={{ color: '#dc2626' }}>*</span></label>
                  <input style={inp} value={sc.name} onChange={e => setSCField(i, 'name', e.target.value)} required minLength={2} />
                </div>
                <div style={fld}>
                  <label style={lbl}>Sports <span style={{ color: '#dc2626' }}>*</span></label>
                  <SportsSelector selected={sc.sports} onChange={v => setSCField(i, 'sports', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div style={fld}>
                    <label style={lbl}>Hourly rate (₹) <span style={{ color: '#dc2626' }}>*</span></label>
                    <input style={inp} type="number" min="0.01" step="0.01" value={sc.hourly_price}
                      onChange={e => setSCField(i, 'hourly_price', e.target.value)} required />
                  </div>
                  <div style={fld}>
                    <label style={lbl}>Opens at</label>
                    <input style={inp} type="time" value={sc.opening_hour}
                      onChange={e => setSCField(i, 'opening_hour', e.target.value)} required />
                  </div>
                  <div style={fld}>
                    <label style={lbl}>Closes at</label>
                    <input style={inp} type="time" value={sc.closing_hour}
                      onChange={e => setSCField(i, 'closing_hour', e.target.value)} required />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" onClick={addSC} style={{
              padding: '0.45rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem', color: '#374151',
            }}>
              + Add another sub-court
            </button>
          </div>

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '0.7rem', background: submitting ? '#93c5fd' : '#1d4ed8',
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem',
          }}>
            {submitting ? 'Creating…' : 'Create turf'}
          </button>
        </form>
      </main>
    </div>
  );
}
