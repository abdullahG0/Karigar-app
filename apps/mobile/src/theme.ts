export const colors = {
  primary:       '#2563EB',
  primaryLight:  '#EFF6FF',
  primaryDark:   '#1E40AF',
  accent:        '#F59E0B',
  success:       '#10B981',
  error:         '#EF4444',
  text:          '#111827',
  textMuted:     '#6B7280',
  textLight:     '#9CA3AF',
  border:        '#E5E7EB',
  background:    '#F3F4F6',
  card:          '#FFFFFF',
  white:         '#FFFFFF',
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
};

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 9999,
};

// Status badge config for booking statuses.
export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending_quote: { label: 'Pending Quote', bg: '#FEF3C7', text: '#B45309' },
  quoted:        { label: 'Quoted',        bg: '#DBEAFE', text: '#1D4ED8' },
  confirmed:     { label: 'Confirmed',     bg: '#EDE9FE', text: '#6D28D9' },
  in_progress:   { label: 'In Progress',   bg: '#FFEDD5', text: '#C2410C' },
  completed:     { label: 'Completed',     bg: '#D1FAE5', text: '#065F46' },
  cancelled:     { label: 'Cancelled',     bg: '#F3F4F6', text: '#6B7280' },
};

// Per-index colours for category cards.
export const CATEGORY_BG = [
  '#DBEAFE','#D1FAE5','#FEF3C7','#EDE9FE',
  '#FCE7F3','#FEE2E2','#CFFAFE','#ECFCCB',
];
export const CATEGORY_ICON_COLOR = [
  '#2563EB','#059669','#D97706','#7C3AED',
  '#DB2777','#DC2626','#0891B2','#65A30D',
];

// Ionicons name for each backend icon_name value.
export const ICON_MAP: Record<string, string> = {
  wrench:      'construct-outline',
  zap:         'flash-outline',
  leaf:        'leaf-outline',
  sparkles:    'sparkles-outline',
  hammer:      'hammer-outline',
  paintbrush:  'brush-outline',
  wind:        'thermometer-outline',
  bug:         'bug-outline',
};
