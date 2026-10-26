import { request } from "./client";

const TOKEN_KEY = "welfareone_access_token";

export interface UserProfile {
  user_id: number;
  email: string;
  nickname: string;
  default_region_level1?: string;
  default_region_level2?: string;
  default_age?: number;
  has_api_key: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface SignUpData {
  email: string;
  password: string;
  nickname: string;
  default_region_level1?: string;
  default_region_level2?: string;
  default_age?: number;
}

export interface LoginData {
  email: string;
  password: string;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function signUp(data: SignUpData): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.access_token) {
    setAuthToken(res.access_token);
  }
  return res;
}

export async function login(data: LoginData): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (res.access_token) {
    setAuthToken(res.access_token);
  }
  return res;
}

export async function getMe(): Promise<UserProfile | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    return await request<UserProfile>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    removeAuthToken();
    return null;
  }
}

export async function saveServerApiKey(apiKey: string): Promise<{ has_api_key: boolean }> {
  const token = getAuthToken();
  if (!token) throw new Error("로그인 후 API 키를 저장할 수 있어요.");
  return await request<{ has_api_key: boolean }>("/users/api-key", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ api_key: apiKey }),
  });
}

export async function getServerApiKeyStatus(): Promise<{ has_api_key: boolean }> {
  const token = getAuthToken();
  if (!token) throw new Error("로그인이 필요해요.");
  return await request<{ has_api_key: boolean }>("/users/api-key/status", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteServerApiKey(): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error("로그인이 필요해요.");
  await request<{ message: string }>("/users/api-key", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface UpdateProfileData {
  default_region_level1?: string;
  default_region_level2?: string;
  default_age?: number | null;
}

export async function updateProfile(data: UpdateProfileData): Promise<UserProfile> {
  const token = getAuthToken();
  return await request<UserProfile>("/auth/me", {
    method: "PUT",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(data),
  });
}


