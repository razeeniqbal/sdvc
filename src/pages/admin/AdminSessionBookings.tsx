import { useParams } from 'react-router-dom';
import AdminBookingsPage from './AdminBookingsPage';

// Bookings tab of the session workspace: the same booking/payment management as
// /admin/bookings (no duplicated logic), locked to this session.
export default function AdminSessionBookings() {
  const { id } = useParams<{ id: string }>();
  return <AdminBookingsPage key={id} sessionId={id} />;
}
