/**
 * API 基址。开发与自托管为同源（空字符串）；
 * Qoder Site 上由 VITE_API_BASE 指向 Edge Function 代理前缀。
 */
const raw = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
export const API_BASE = raw.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (!path.startsWith('/api/')) return path;
  return API_BASE ? `${API_BASE}${path}` : path;
}
