import api from './api';

function notifyAuthTokenChanged() {
  window.dispatchEvent(new CustomEvent('mw:auth-token-changed'));
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/login', credentials);
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      notifyAuthTokenChanged();
    }
    return response.data;
  },

  async logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    notifyAuthTokenChanged();
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  async getProfile(): Promise<UserProfile> {
    const response = await api.get<UserProfile>('/api/auth/profile');
    return response.data;
  },

  async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    const response = await api.put<UserProfile>('/api/auth/profile', data);
    // Update local storage with new user data
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, email: response.data.email };
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
    return response.data;
  },
};







