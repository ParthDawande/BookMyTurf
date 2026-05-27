import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiError } from '../hooks/useApiError';
import { ErrorBanner } from '../components/ErrorBanner';

// Customer registration fields: name, email, phone (10-digit), password, city.
// preferred_sports optional. On success: auto-login via authContext.login().
// Post-register flow: auto-login then redirect to /customer.

const s = {
  page:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-neutral-100)', padding: 'var(--space-4)' },
  card:  { background: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-8)', width: '100%', maxWidth: 440 },
  title: { fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-6)', textAlign: 'center' },
  group: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' },
  label: { fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-neutral-600)' },
  input: { padding: 'var(--space-3)', border: '1px solid var(--color-neutral-200)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-base)', width: '100%' },
  hint:  { fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-400)', marginTop: 2 },
  btn:   { width: '100%', padding: 'var(--space-3)', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--font-size-base)', cursor: 'pointer', marginTop: 'var(--space-2)' },
  foot:  { textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)' },
};

export default function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const { error, setError, clearError } = useApiError();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', city: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    clearError();
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // snake_case payload to match wire format (no camelCase transformer)
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, city: form.city });
      // Auto-login after successful registration
      await login(form.email, form.password);
      navigate('/customer', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Create account</h1>
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
          <div style={s.group}>
            <label style={s.label}>City</label>
            <input style={s.input} name="city" value={form.city} onChange={handleChange} required />
          </div>
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p style={s.foot}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
