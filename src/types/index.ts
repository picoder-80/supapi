// types/index.ts

export type UserRole =
  | "pioneer"
  | "seller"
  | "instructor"
  | "host"
  | "admin"
  | "super_admin"
  | "account_admin"
  | "staff_admin"
  | "marketing_admin"
  | "banned";

export type KycStatus = "unverified" | "pending" | "verified";

export interface User {
  id: string;
  pi_uid: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  email: string | null;
  role: UserRole;
  kyc_status: KycStatus;
  wallet_address: string | null;
  pi_balance_pending: number;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── CLASSIFIED ──────────────────────────────────────────
export type ListingStatus = "active" | "sold" | "pending" | "removed";
export type ListingCategory =
  | "elektronik"
  | "fesyen"
  | "rumah"
  | "kenderaan"
  | "perkhidmatan"
  | "digital"
  | "makanan"
  | "lain";

export interface Listing {
  id: string;
  seller_id: string;
  seller?: User;
  title: string;
  description: string;
  price_pi: number;
  category: ListingCategory;
  images: string[];
  location: string | null;
  status: ListingStatus;
  is_featured: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
}

// ── GIGS ────────────────────────────────────────────────
export type GigStatus = "active" | "paused" | "removed";
export type OrderStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "delivered"
  | "completed"
  | "disputed"
  | "cancelled";

export interface GigPackage {
  name: string;
  description: string;
  price_pi: number;
  delivery_days: number;
  revisions: number;
}

export interface Gig {
  id: string;
  seller_id: string;
  seller?: User;
  title: string;
  description: string;
  category: string;
  packages: GigPackage[];
  images: string[];
  tags: string[];
  status: GigStatus;
  rating_avg: number;
  rating_count: number;
  orders_completed: number;
  created_at: string;
}

export interface Order {
  id: string;
  gig_id: string;
  gig?: Gig;
  buyer_id: string;
  buyer?: User;
  seller_id: string;
  package_index: number;
  price_pi: number;
  status: OrderStatus;
  requirements: string | null;
  delivery_url: string | null;
  pi_payment_id: string | null;
  escrow_released: boolean;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── ACADEMY ─────────────────────────────────────────────
export interface Course {
  id: string;
  instructor_id: string;
  instructor?: User;
  title: string;
  description: string;
  price_pi: number;
  thumbnail_url: string | null;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  is_published: boolean;
  enrollment_count: number;
  rating_avg: number;
  created_at: string;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  video_url: string | null;
  content: string | null;
  order_index: number;
  duration_minutes: number;
  is_free_preview: boolean;
}

// ── STAY ────────────────────────────────────────────────
export interface Stay {
  id: string;
  host_id: string;
  host?: User;
  title: string;
  description: string;
  price_pi_per_night: number;
  address: string;
  city: string;
  images: string[];
  amenities: string[];
  max_guests: number;
  bedrooms: number;
  is_available: boolean;
  rating_avg: number;
  created_at: string;
}

// ── PAYMENTS / TRANSACTIONS ──────────────────────────────
export type TransactionType =
  | "purchase"
  | "sale"
  | "referral_reward"
  | "game_reward"
  | "course_enrollment"
  | "stay_booking"
  | "escrow_release"
  | "platform_fee";

export type TransactionStatus = "pending" | "completed" | "failed" | "refunded";

export interface Transaction {
  id: string;
  user_id: string;
  counterpart_id: string | null;
  type: TransactionType;
  amount_pi: number;
  pi_payment_id: string;
  reference_id: string | null;
  reference_type: string | null;
  status: TransactionStatus;
  memo: string;
  created_at: string;
}

// ── REFERRAL ─────────────────────────────────────────────
export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  reward_pi: number;
  reward_paid: boolean;
  created_at: string;
}

// ── REVIEWS ──────────────────────────────────────────────
export interface Review {
  id: string;
  reviewer_id: string;
  reviewer?: User;
  target_id: string;
  target_type: "listing" | "gig" | "course" | "stay" | "user";
  rating: number;
  comment: string | null;
  images?: string[];
  created_at: string;
}

// ── API RESPONSE ─────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}