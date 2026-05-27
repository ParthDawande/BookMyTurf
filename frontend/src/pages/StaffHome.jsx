import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const s = {
  page: { padding: 'var(--space-8)', maxWidth: 600, margin: '0 auto' },
  btn:  { marginTop: 'var(--space-6)', padding: 'var(--space-2) var(--space-6)', background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 },
};

export default function StaffHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/', { replace: true }); };

  return (
    <div style={s.page}>
      <h1>Staff Portal</h1>
      <p>Welcome, <strong>{user?.email}</strong>.</p>
      <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-neutral-600)' }}>
        Staff pages coming in a later sub-phase.
      </p>
      <button style={s.btn} onClick={handleLogout}>Logout</button>
    </div>
  );
}
