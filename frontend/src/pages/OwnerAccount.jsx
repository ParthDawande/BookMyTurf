import { useState, useEffect } from 'react';
import { getProfile, updateProfile } from '../api/ownerTurfs';
import Header from '../components/Header';
import OwnerNav from '../components/OwnerNav';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const inp = {
  padding: '0.5rem 0.7rem', border: '1px solid #d1d5db',
  borderRadius: '5px', fontSize: '0.9rem',
  boxSizing: 'border-box', width: '100%',
};
const fld = { display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.1rem' };
const lbl = { fontSize: '0.85rem', fontWeight: 600, color: '#374151' };

export default function OwnerAccount() {
  const [orig,     setOrig]     = useState(null);
  const [form,     setForm]     = useState({ bank_account_number: '', ifsc_code: '' });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState(null); // 'saved' | 'error:<text>'
  const [fetchErr, setFetchErr] = useState(null);

  useEffect(() => {
    getProfile()
      .then(res => {
        const d = res.data;
        const o = {
          bank_account_number: d.bank_account_number || '',
          ifsc_code:           d.ifsc_code           || '',
        };
        setOrig(o);
        setForm({ ...o });
      })
      .catch(() => setFetchErr('Failed to load profile. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  // Only fields that changed AND are non-empty
  function changedFields() {
    if (!orig) return {};
    const body = {};
    if (form.bank_account_number !== orig.bank_account_number && form.bank_account_number)
      body.bank_account_number = form.bank_account_number;
    if (form.ifsc_code !== orig.ifsc_code && form.ifsc_code)
      body.ifsc_code = form.ifsc_code;
    return body;
  }

  const changed = changedFields();
  const hasChanges = Object.keys(changed).length > 0;

  const ifscWarn = form.ifsc_code !== '' && !IFSC_RE.test(form.ifsc_code);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hasChanges) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await updateProfile(changed);
      const d = res.data;
      const newOrig = {
        bank_account_number: d.bank_account_number || '',
        ifsc_code:           d.ifsc_code           || '',
      };
      setOrig(newOrig);
      setForm({ ...newOrig });
      setMsg('saved');
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg('error:' + (err.response?.data?.error || 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <OwnerNav />

      <main style={{ maxWidth: '520px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ margin: '0 0 1.5rem', color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
          Account
        </h1>

        {fetchErr && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
          }}>
            {fetchErr}
          </div>
        )}

        {loading && (
          <div style={{
            background: '#fff', borderRadius: '10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '1.75rem',
          }}>
            <div style={{
              height: '220px', borderRadius: '6px',
              background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
              backgroundSize: '200% 100%',
            }} />
          </div>
        )}

        {!loading && !fetchErr && (
          <div style={{
            background: '#fff', borderRadius: '10px', padding: '1.75rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}>
            <h2 style={{ margin: '0 0 0.6rem', color: '#1e3a5f', fontSize: '1rem', fontWeight: 600 }}>
              Bank Details
            </h2>
            <p style={{ margin: '0 0 1.4rem', fontSize: '0.84rem', color: '#6b7280', lineHeight: 1.55 }}>
              Your payout amounts are transferred to this account.
              Both fields must be set to activate payouts.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={fld}>
                <label style={lbl}>Bank Account Number</label>
                <input
                  style={inp}
                  value={form.bank_account_number}
                  onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))}
                  placeholder="Enter account number"
                  autoComplete="off"
                />
              </div>

              <div style={fld}>
                <label style={lbl}>IFSC Code</label>
                <input
                  style={{ ...inp, borderColor: ifscWarn ? '#f59e0b' : '#d1d5db' }}
                  value={form.ifsc_code}
                  onChange={e => setForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. HDFC0001234"
                  autoComplete="off"
                  maxLength={11}
                />
                {ifscWarn && (
                  <div style={{
                    fontSize: '0.78rem', color: '#92400e',
                    background: '#fef3c7', border: '1px solid #fcd34d',
                    borderRadius: '4px', padding: '0.3rem 0.65rem',
                  }}>
                    IFSC format: 4 letters + 0 + 6 characters (e.g. HDFC0001234)
                  </div>
                )}
              </div>

              {msg === 'saved' && (
                <div style={{ color: '#166534', fontSize: '0.88rem', marginBottom: '0.85rem' }}>
                  ✅ Bank details saved.
                </div>
              )}
              {msg?.startsWith('error:') && (
                <div style={{ color: '#b91c1c', fontSize: '0.88rem', marginBottom: '0.85rem' }}>
                  {msg.slice(6)}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <button
                  type="submit"
                  disabled={!hasChanges || saving}
                  style={{
                    padding: '0.6rem 1.5rem',
                    background: !hasChanges || saving ? '#93c5fd' : '#1d4ed8',
                    color: '#fff', border: 'none', borderRadius: '5px',
                    cursor: !hasChanges || saving ? 'not-allowed' : 'pointer',
                    fontWeight: 600, fontSize: '0.9rem',
                  }}>
                  {saving ? 'Saving…' : 'Save bank details'}
                </button>
                {!hasChanges && orig && (orig.bank_account_number || orig.ifsc_code) && (
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No changes to save.</span>
                )}
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
