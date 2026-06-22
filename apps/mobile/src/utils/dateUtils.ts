/**
 * SQLite stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" without a timezone
 * marker, but the value is UTC. JavaScript's Date constructor treats strings
 * without a timezone as LOCAL time, making timestamps appear offset by the
 * device's UTC offset (e.g. PKT = UTC+5 → times look 5 hours old).
 *
 * Always parse DB timestamps through this function so they're treated as UTC.
 */
function parseUtc(str: string): Date {
  if (!str) return new Date(NaN);
  // Already ISO with timezone info — use as-is.
  if (str.includes('Z') || str.includes('+')) return new Date(str);
  // SQLite space-separator format → ISO T-separator + Z (UTC).
  const iso = str.includes('T') ? str + 'Z' : str.replace(' ', 'T') + 'Z';
  return new Date(iso);
}

export function timeAgo(str: string): string {
  const diff = Date.now() - parseUtc(str).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

export function formatDate(str: string): string {
  try {
    return parseUtc(str).toLocaleDateString('en-PK', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return str; }
}

export function formatDateTime(str: string): string {
  try {
    return parseUtc(str).toLocaleString('en-PK', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return str; }
}
