import { NavLink } from 'react-router-dom';

const TEAL = '#0d9488';

const links = [
  { to: '/staff/complaints',    label: 'Complaints' },
  { to: '/staff/queries',       label: 'Queries' },
  { to: '/staff/notifications', label: 'Notifications' },
];

export default function StaffNav() {
  return (
    <nav style={{
      background: '#fff', borderBottom: '1px solid #e5e7eb',
      padding: '0 1rem', display: 'flex', gap: 0, overflowX: 'auto',
    }}>
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            display: 'inline-block', padding: '0.65rem 1.1rem',
            fontSize: '0.88rem', fontWeight: isActive ? 600 : 400,
            color: isActive ? TEAL : '#374151',
            borderBottom: isActive ? `2px solid ${TEAL}` : '2px solid transparent',
            textDecoration: 'none', whiteSpace: 'nowrap',
          })}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
