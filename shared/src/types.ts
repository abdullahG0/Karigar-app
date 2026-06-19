export interface User {
  id: string;
  name: string;
  phone: string;
  role: 'resident' | 'professional' | 'admin';
  society_id: string;
  created_at: string;
}

export interface Professional {
  id: string;
  user_id: string;
  category_ids: string[];
  rating: number;
  total_jobs: number;
  is_verified: boolean;
  is_available: boolean;
  bio: string;
  hourly_rate: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon_name: string;
  description: string;
  base_price_range: string;
}

export interface Booking {
  id: string;
  resident_id: string;
  professional_id: string;
  category_id: string;
  status:
    | 'pending'
    | 'quoted'
    | 'accepted'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  scheduled_at: string;
  address: string;
  problem_description: string;
  quote_amount: number | null;
  final_amount: number | null;
  created_at: string;
}

export interface Quote {
  id: string;
  booking_id: string;
  professional_id: string;
  amount: number;
  note: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  resident_id: string;
  professional_id: string;
  rating: number;
  comment: string;
  created_at: string;
}
