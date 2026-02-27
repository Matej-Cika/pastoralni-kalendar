import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Database types
export type UserRole = 'PRIEST' | 'PARISHIONER'

export type EventType =
  | 'DEVOTION'
  | 'ACTIVITY'
  | 'SACRAMENT'

export type EventCategory = 'DEVOTION' | 'ACTIVITY' | 'SACRAMENT'

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  event_type: EventType
  color: string
  is_private: boolean
  created_by: string
  is_deleted: boolean
  // Links to the booking that generated this event (added in migration 011)
  booking_id: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  event_id: string
  person_name: string
  google_contact_id: string | null
  phone_number: string | null
  conversation_type: string
  private_notes: string | null
}

export interface AvailabilitySlot {
  id: string
  date: string
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
}

export interface BookingNote {
  id:         string
  booking_id: string
  priest_id:  string
  note:       string
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  availability_slot_id: string | null  // null when slot was deleted; slot_date used for stats
  slot_date?: string | null  // preserved when slot deleted, for stats (odrađene)
  parishioner_id: string
  // Smart-booking contact fields (added in migration 004)
  parishioner_first_name: string | null
  parishioner_last_name:  string | null
  parishioner_phone:      string | null
  // Requested sub-interval within the availability window ('HH:MM' format)
  requested_start_time: string | null
  requested_end_time:   string | null
  duration_minutes:     number | null
  purpose: string
  status: BookingStatus
  // Who cancelled the booking (added in migration 007)
  cancelled_by: 'PRIEST' | 'PARISHIONER' | null
  // Reason provided by priest when cancelling (added in migration 009)
  cancellation_reason: string | null
  // Status before cancel (PENDING = withdrawn request, CONFIRMED = cancelled meeting)
  cancelled_from_status: 'PENDING' | 'CONFIRMED' | null
  created_at: string
  updated_at: string
  availability_slot?: AvailabilitySlot
}
