// Format price in ILS
export function formatPrice(price: string | number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
  }).format(numPrice);
}

// Format date in Hebrew
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format date for input (YYYY-MM-DD)
export function formatDateForInput(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

// Get current username from token
export function getCurrentUsername(): string {
  if (typeof window === 'undefined') return '';

  try {
    const token = localStorage.getItem('token');
    if (!token) return '';

    const base64 = token.split('.')[1];
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    );
    const payload = JSON.parse(decoded);
    return payload.username || '';
  } catch {
    return '';
  }
}

// Status label translation
export function getStatusLabel(status: string): string {
  const namesMap: Record<string, string> = {
    alex: 'אלכס',
    bachti: 'בכטי',
    farid: 'פריד',
    ariel: 'אריאל',
    sharon: 'שרון',
    dvir: 'דביר',
    lior: 'ליאור',
    shlomi: 'שלומי',
    adir: 'אדיר',
    adam: 'אדם',
    joni: "ג'וני",
    ben: 'בן',
    nikos: 'ניקוס',
    dima: 'ארטיום',
    rafi: 'רפי',
  };

  const parts = status.split('-');
  if (parts.length < 2) return status;

  const [type, name] = parts;
  const translatedName = namesMap[name] || name;

  if (type === 'done') {
    return `הושלם - ${translatedName}`;
  } else if (type === 'un') {
    return `לא נמסר - ${translatedName}`;
  } else if (type.includes('toam')) {
    return `תואם - ${translatedName}`;
  }

  return status;
}

// Session expiry duration (7 days in milliseconds)
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// Check if user is authenticated and session is valid
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('token');
  const loginTime = localStorage.getItem('loginTime');
  
  if (!token || !loginTime) return false;
  
  // Check if session has expired (7 days)
  const loginTimestamp = parseInt(loginTime, 10);
  const now = Date.now();
  
  if (now - loginTimestamp > SESSION_DURATION) {
    // Session expired - clear auth data
    clearAuthData();
    return false;
  }
  
  return true;
}

// Get auth token
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// Set auth data with login timestamp
export function setAuthData(token: string, username: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
  localStorage.setItem('username', username);
  localStorage.setItem('loginTime', Date.now().toString());
  
  // Also set cookie for middleware (7 days)
  document.cookie = `auth_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}`;
}

// Clear auth data
export function clearAuthData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('loginTime');
  localStorage.removeItem('savedUsername');
  localStorage.removeItem('savedPassword');
  
  // Also clear cookie
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

// Detect store from order ID (legacy fallback)
export function detectStoreFromOrderId(orderId: string): string {
  if (/^[34]/.test(orderId)) {
    return '2';
  }
  return '1';
}
