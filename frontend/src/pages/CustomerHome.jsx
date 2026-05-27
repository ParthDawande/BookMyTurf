import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useState } from 'react';

const s = {
  page: { padding: 'var(--space-8)', maxWidth: 600, margin: '0 auto' },
  btn:  { marginTop: 'var(--space-6)', padding: 'var(--space-2) var(--space-6)', background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 },
  notif:{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)' },
};

export default function CustomerHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifResult, setNotifResult] = useState(null);

  const handleLogout = () => { logout(); navigate('/', { replace: true }); };

  // Demonstrates axios interceptor: Authorization header is attached automatically.
  const fetchNotifications = async () => {
    const { data } = await client.get('/api/notifications');
    setNotifResult(`GET /api/notifications → 200, total_results=${data.total_results}`);
  };

  return (
    <div style={s.page}>
      <h1>Customer Portal</h1>
      <p>Welcome, <strong>{user?.email}</strong>.</p>
      <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-neutral-600)' }}>
        Customer pages coming in 9-customer-auth-and-browse.
      </p>
      <button style={{ ...s.btn, background: 'var(--color-primary)', marginRight: 'var(--space-4)' }} onClick={fetchNotifications}>
        Test: GET /api/notifications
      </button>
      <button style={s.btn} onClick={handleLogout}>Logout</button>
      {notifResult && <p style={s.notif}>{notifResult}</p>}
    </div>
  );
}
