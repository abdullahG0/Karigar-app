import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: 'resident' | 'professional' | 'admin';
  society_id: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    phone: string;
    password: string;
    role: string;
    society_id?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

const TOKEN_KEY = 'auth_token';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const { data } = await api.get('/auth/me');
        set({ user: data, token, isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      delete api.defaults.headers.common['Authorization'];
      set({ user: null, token: null, isInitialized: true });
    }
  },

  login: async (phone, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { phone, password });
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      set({ user: data.user, token: data.token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (formData) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/register', {
        ...formData,
        society_id: formData.society_id ?? 'soc_pvc_isl',
      });
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      set({ user: data.user, token: data.token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, token: null });
  },
}));
