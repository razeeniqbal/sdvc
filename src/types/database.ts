export type SessionStatus = 'Open' | 'Closed' | 'Cancelled';

export type BookingStatus =
  | 'Pending Payment'
  | 'Confirmed'
  | 'Cancelled by Player'
  | 'Cancelled by Admin'
  | 'Completed'
  | 'No Show'
  | 'Refunded';

export type PaymentStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'Cancelled'
  | 'Refunded'
  | 'Partially Refunded'
  | 'Manual Payment Pending Verification';

export type PaymentMethod =
  | 'Credit Card'
  | 'Debit Card'
  | 'FPX'
  | 'DuitNow QR'
  | 'E-Wallet'
  | 'Manual Bank Transfer'
  | 'Cash';

export type WaitingListStatus = 'Waiting' | 'Offered' | 'Booked' | 'Expired' | 'Cancelled';

export type AttendanceStatus = 'Attended' | 'Absent' | 'No Show' | 'Cancelled';

export type UserRole = 'player' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  short_name: string | null;
  email: string;
  phone_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  maps_link: string | null;
  court_number: string | null;
  price: number;
  maximum_capacity: number;
  booking_open_at: string | null;
  booking_close_at: string | null;
  cancellation_deadline: string | null;
  status: SessionStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  booking_reference: string;
  user_id: string;
  session_id: string;
  booking_status: BookingStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  processing_fee: number;
  discount_amount: number;
  total_amount: number;
  reserved_until: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  session?: Session;
  profile?: Profile;
}

export interface Payment {
  id: string;
  booking_id: string;
  payment_reference: string;
  payment_provider: string;
  payment_method: PaymentMethod | null;
  amount: number;
  payment_status: PaymentStatus;
  transaction_reference: string | null;
  paid_at: string | null;
  refunded_amount: number;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitingListEntry {
  id: string;
  user_id: string;
  session_id: string;
  queue_position: number;
  status: WaitingListStatus;
  offer_expires_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Attendance {
  id: string;
  booking_id: string;
  attendance_status: AttendanceStatus | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  booking_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  delivery_channel: 'in_app' | 'email' | 'whatsapp' | 'sms' | 'push';
  delivery_status: 'Pending' | 'Sent' | 'Failed';
  sent_at: string | null;
  created_at: string;
}

export interface ClubSettings {
  id: number;
  club_name: string;
  contact_person_name: string;
  contact_whatsapp: string;
  whatsapp_group_link: string;
  whatsapp_group_notify: boolean;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Credit Card',
  'Debit Card',
  'FPX',
  'DuitNow QR',
  'E-Wallet',
  'Manual Bank Transfer',
  'Cash',
];
