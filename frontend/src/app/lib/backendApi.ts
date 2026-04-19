const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

type JsonObject = Record<string, unknown>;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export interface LoginPayload {
  userId: string;
  username: string;
  email?: string;
}

export interface LoginResponse {
  player_id: string;
  state: JsonObject;
}

export function loginOrRegisterPlayer(payload: LoginPayload): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      user_id: payload.userId,
      username: payload.username,
      email: payload.email ?? '',
    }),
  });
}

export function syncGameProgress(token: string, payload: { clicks: number; depth_gain: number }): Promise<{ status: string }> {
  return request<{ status: string }>('/api/game/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

// ── Catalog API ─────────────────────────────────────────────

export interface CatalogItem {
  sku: string;
  name: string;
  description: string;
  image_url?: string;
  category: string;
  currency: string;       // "real" | "gem"
  price: number;
  price_str: string;
  gems_granted: number;
  featured: boolean;
  one_time: boolean;
  effect_type?: string;
  effect_value?: number;
  effect_duration?: number;
}

export interface CatalogResponse {
  source: string;         // "xsolla" | "database"
  items: CatalogItem[];
}

export function fetchStoreCatalog(): Promise<CatalogResponse> {
  return request<CatalogResponse>('/api/store/catalog');
}

// ── Gem purchase API ────────────────────────────────────────

export function buyGemItem(token: string, sku: string): Promise<{ status: string }> {
  return request<{ status: string }>('/api/store/buy-gem-item', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sku }),
  });
}

// ── Game Items API ──────────────────────────────────────────

export interface GameItem {
  name: string;
  count: number;
}

export interface GameItemsResponse {
  items: GameItem[];
}

export function getGameItems(authToken: string): Promise<GameItemsResponse> {
  return request<GameItemsResponse>('/api/game/items', {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
}

// ── PayStation API ──────────────────────────────────────────

export interface CreatePaymentResponse {
  token: string;
  order_id: number;
}

export function createPayment(authToken: string, sku: string): Promise<CreatePaymentResponse> {
  return request<CreatePaymentResponse>('/api/store/create-payment', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ sku }),
  });
}
