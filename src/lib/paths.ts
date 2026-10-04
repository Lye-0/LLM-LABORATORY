const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix an app-local URL once; leave external URLs and fragments unchanged. */
export function withBase(url: string): string {
  if (!base || !url.startsWith('/') || url.startsWith('//')) return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

/** Use section-local paths when choosing the active navigation item. */
export function withoutBase(pathname: string): string {
  if (!base) return pathname;
  if (pathname === base) return '/';
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}
