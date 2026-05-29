import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RoleGuard } from './components/RoleGuard';

import Landing      from './pages/Landing';
import Login        from './pages/Login';
import Register     from './pages/Register';
import CustomerHome from './pages/CustomerHome';
import OwnerHome    from './pages/OwnerHome';
import AdminHome    from './pages/AdminHome';
import StaffHome    from './pages/StaffHome';
import TurfList      from './pages/TurfList';
import TurfDetail    from './pages/TurfDetail';
import BookingReceipt  from './pages/BookingReceipt';
import MyBookings      from './pages/MyBookings';
import ReschedulePage  from './pages/ReschedulePage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"           element={<Landing />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />

        {/* Public browse — no auth required for list; detail requires CUSTOMER auth for full content */}
        <Route path="/turfs"      element={<TurfList />} />
        <Route path="/turfs/:id"  element={<TurfDetail />} />

        {/* Booking pages — more specific than /customer/* so they match first */}
        <Route path="/customer/bookings" element={
          <RoleGuard role="CUSTOMER"><MyBookings /></RoleGuard>
        } />
        <Route path="/customer/bookings/:id/reschedule" element={
          <RoleGuard role="CUSTOMER"><ReschedulePage /></RoleGuard>
        } />
        <Route path="/customer/bookings/:id" element={
          <RoleGuard role="CUSTOMER"><BookingReceipt /></RoleGuard>
        } />
        <Route path="/customer/*" element={
          <RoleGuard role="CUSTOMER"><CustomerHome /></RoleGuard>
        } />
        <Route path="/owner/*" element={
          <RoleGuard role="OWNER"><OwnerHome /></RoleGuard>
        } />
        <Route path="/admin/*" element={
          <RoleGuard role="ADMIN"><AdminHome /></RoleGuard>
        } />
        <Route path="/staff/*" element={
          <RoleGuard role="STAFF"><StaffHome /></RoleGuard>
        } />
      </Routes>
    </AuthProvider>
  );
}
