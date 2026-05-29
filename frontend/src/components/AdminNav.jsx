import { NavLink } from 'react-router-dom';

const links = [
  { to: '/admin/dashboard',     label: 'Dashboard' },
  { to: '/admin/approvals',     label: 'Approvals' },
  { to: '/admin/users',         label: 'Users' },
  { to: '/admin/staff',         label: 'Staff' },
  { to: '/admin/complaints',    label: 'Complaints' },
  { to: '/admin/queries',       label: 'Queries' },
  { to: '/admin/notifications', label: 'Notifications' },
];

export default function AdminNav() {
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
            color: isActive ? '#7c3aed' : '#374151',
            borderBottom: isActive ? '2px solid #7c3aed' : '2px solid transparent',
            textDecoration: 'none', whiteSpace: 'nowrap',
          })}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
