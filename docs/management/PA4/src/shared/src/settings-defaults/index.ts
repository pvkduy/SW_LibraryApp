/**
 * Settings defaults — copied verbatim from SRS §4.17 (`settings` table, key `library`).
 *
 * Source of truth: specs/SHELFHELP_FULLSPEC.md §4.17.
 * Constitution Principle VII: never hardcode a limit, fee, or duration. Read from here
 * (server: the `settings` table) instead.
 */

export interface MemberPrivileges {
  max_items: number
  loan_days_options: number[]
  renewals: number
  can_reserve: boolean
}

export interface MembershipPlan {
  name: string
  duration_days: number
  price: number
  privileges: MemberPrivileges
}

export interface LibrarySettings {
  timezone: string
  email_domain_allowlist: string[]
  student_id_pattern: string
  unverified_account_ttl_days: number

  nonmember: MemberPrivileges
  premium_fee_per_7_days: number
  plans: MembershipPlan[]
  plan_renewal_window_days: number
  membership_reminder_days: number

  fine_per_day: number
  fine_grace_days: number
  lost_threshold_days: number
  lost_warning_days_before: number
  lost_return_refund_window_days: number
  default_replacement_price: number
  damage_tiers_percent: { minor: number; major: number; unusable: number }

  online_payment_window_min: number
  pickup_window_hours: number
  pickup_warning_hours: number

  due_soon_days: number
  overdue_email_days: number[]

  reservation: {
    queue_limit: number
    max_active_per_member: number
    strike_window_days: number
    strikes_before_ban: number
    ban_days: number
  }

  wishlist_max: number
  suggestion: { max_open_per_student: number; similarity_threshold: number }
  bulk_import_max_rows: number
  export_max_rows: number

  chat: {
    rate_per_hour: number
    rate_per_day: number
    top_k: number
    max_recommendations: number
    /** Tuned after evaluation; 0.55 cosine is the starting value stated in §4.17. */
    min_similarity: number
  }

  search: { fuzzy_threshold: number }
  notification_retention_days: number
}

export const DEFAULT_SETTINGS: LibrarySettings = {
  timezone: 'Asia/Ho_Chi_Minh',
  email_domain_allowlist: ['*.edu.vn'],
  student_id_pattern: '^[A-Za-z0-9]{6,15}$',
  unverified_account_ttl_days: 7,

  nonmember: {
    max_items: 3,
    loan_days_options: [7],
    renewals: 1,
    can_reserve: false,
  },
  premium_fee_per_7_days: 5000,
  plans: [
    {
      name: 'Academic Year',
      duration_days: 365,
      price: 150000,
      privileges: {
        max_items: 7,
        loan_days_options: [7, 14],
        renewals: 2,
        can_reserve: true,
      },
    },
  ],
  plan_renewal_window_days: 30,
  membership_reminder_days: 7,

  fine_per_day: 2000,
  fine_grace_days: 0,
  lost_threshold_days: 60,
  lost_warning_days_before: 7,
  lost_return_refund_window_days: 90,
  default_replacement_price: 100000,
  damage_tiers_percent: { minor: 10, major: 30, unusable: 100 },

  online_payment_window_min: 30,
  pickup_window_hours: 48,
  pickup_warning_hours: 12,

  due_soon_days: 2,
  overdue_email_days: [7, 14],

  reservation: {
    queue_limit: 5,
    max_active_per_member: 3,
    strike_window_days: 180,
    strikes_before_ban: 2,
    ban_days: 30,
  },

  wishlist_max: 50,
  suggestion: { max_open_per_student: 5, similarity_threshold: 0.85 },
  bulk_import_max_rows: 1000,
  export_max_rows: 20000,

  chat: {
    rate_per_hour: 20,
    rate_per_day: 100,
    top_k: 10,
    max_recommendations: 5,
    min_similarity: 0.55,
  },

  search: { fuzzy_threshold: 0.3 },
  notification_retention_days: 90,
}
