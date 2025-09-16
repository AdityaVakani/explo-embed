export function escapeHtml(value: string): string {
  return value.replace(/[<>]/g, '');
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0]?.trim() ?? '';
  }
  return headers.get('x-real-ip') ?? '';
}

export function normalizeState(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return normalized.length ? normalized : null;
}
