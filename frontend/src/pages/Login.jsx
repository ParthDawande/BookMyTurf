import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiError } from '../hooks/useApiError';
import { ErrorBanner } from '../components/ErrorBanner';

const ROLE_HOME = { CUSTOMER: '/customer', OWNER: '/owner', ADMIN: '/admin', STAFF: '/staff' };

const s = {
  page:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-neutral-100)' },
  card:  { background: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-8)', width: '100%', maxWidth: 400 },
  title: { fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-6)', textAlign: 'center' },
  group: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' },
  label: { fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-neutral-600)' },
  input: { padding: 'var(--space-3)', border: '1px solid var(--color-neutral-200)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-base)', width: '100%' },
  btn:   { width: '100%', padding: 'var(--space-3)', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--font-size-base)', cursor: 'pointer', marginTop: 'var(--space-2)' },
  foot:  { textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)' },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { error, setError, clearError } = useApiError();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    clearError();
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(ROLE_HOME[user.role] || '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Sign in</h1>
        <ErrorBanner error={error} />
        <form onSubmit={handleSubmit}>
          <div style={s.group}>
            <label style={s.label}>Email</label>
            <input style={s.input} name="email" type="email" value={form.email} onChange={handleChange} required autoFocus />
          </div>
          <div style={s.group}>
            <label style={s.label}>Password</label>
            <input style={s.input} name="password" type="password" value={form.password} onChange={handleChange} required />
          </div>
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={s.foot}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
