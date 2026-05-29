import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiError } from '../hooks/useApiError';
import { ErrorBanner } from '../components/ErrorBanner';
import client from '../api/client';

const s = {
  page:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-neutral-100)', padding: 'var(--space-4)' },
  card:  { background: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-8)', width: '100%', maxWidth: 480 },
  title: { fontSize: 'var(--font-size-2xl)', marginBottom: '0.25rem', textAlign: 'center' },
  sub:   { fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-400)', textAlign: 'center', marginBottom: 'var(--space-6)' },
  group: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' },
  label: { fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-neutral-600)' },
  input: { padding: 'var(--space-3)', border: '1px solid var(--color-neutral-200)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-base)', width: '100%', boxSizing: 'border-box' },
  hint:  { fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-400)', marginTop: 2 },
  btn:   { width: '100%', padding: 'var(--space-3)', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--font-size-base)', cursor: 'pointer', marginTop: 'var(--space-2)' },
  foot:  { textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)' },
  divider: { borderTop: '1px solid var(--color-neutral-200)', margin: 'var(--space-4) 0', paddingTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-400)' },
};

export default function RegisterOwner() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { error, setError, clearError } = useApiError();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    bank_account_number: '', ifsc_code: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    clearError();
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { name: form.name, email: form.email, phone: form.phone, password: form.password };
      if (form.bank_account_number) body.bank_account_number = form.bank_account_number;
      if (form.ifsc_code)           body.ifsc_code = form.ifsc_code;

      await client.post('/api/auth/register/owner', body);
      await login(form.email, form.password);
      navigate('/owner/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Register as a turf owner</h1>
        <p style={s.sub}>List your turf and start accepting bookings.</p>
        <ErrorBanner error={error} />
        <form onSubmit={handleSubmit}>
          <div style={s.group}>
            <label style={s.label}>Full name</label>
            <input style={s.input} name="name" value={form.name} onChange={handleChange} required autoFocus />
          </div>
          <div style={s.group}>
            <label style={s.label}>Email</label>
            <input style={s.input} name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>
          <div style={s.group}>
            <label style={s.label}>Phone</label>
            <input style={s.input} name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit number" required />
          </div>
          <div style={s.group}>
            <label style={s.label}>Password</label>
            <input style={s.input} name="password" type="password" value={form.password} onChange={handleChange} required />
            <span style={s.hint}>Min 8 chars, 1 uppercase, 1 number, 1 special character</span>
          </div>

          <div style={s.divider}>Bank details (optional — required before payouts)</div>

          <div style={s.group}>
            <label style={s.label}>Bank account number</label>
            <input style={s.input} name="bank_account_number" value={form.bank_account_number} onChange={handleChange} placeholder="9–18 digits" />
          </div>
          <div style={s.group}>
            <label style={s.label}>IFSC code</label>
            <input style={s.input} name="ifsc_code" value={form.ifsc_code} onChange={handleChange} placeholder="e.g. SBIN0001234" />
          </div>

          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create owner account'}
          </button>
        </form>
        <p style={s.foot}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p style={{ ...s.foot, marginTop: 'var(--space-2)' }}>
          Looking to book a turf? <Link to="/register">Register as a customer</Link>
        </p>
      </div>
    </div>
  );
}
