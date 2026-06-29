import axios from 'axios';

const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwd-rCsGLcW1C46oDGtQFF_tFa3fLFvSQlky7LvsBuel0yEw9xpHQPsVypqHoODDNWadQ/exec";

export const apiClient = axios.create({
  baseURL: GAS_ENDPOINT,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// Interceptor for common query params (if any)
apiClient.interceptors.request.use((config) => {
  // If we need to attach token, we can do it here
  return config;
});

import { supabaseServices } from './supabaseServices';

export const api = {
  get: async (action: string, params: Record<string, any> = {}) => {
    // Route POS actions to Supabase
    if (action in supabaseServices) {
      return await (supabaseServices as any)[action](params.warungId);
    }
    
    // Otherwise fallback to GAS
    const response = await apiClient.get('', {
      params: { action, ...params }
    });
    return response.data;
  },
  post: async (action: string, data: any) => {
    // Special handling for simpanTransaksi
    if (action === 'simpanTransaksi') {
      const res = await supabaseServices.simpanTransaksiOffline(data);
      if (res.status === 'error') return res;
      
      // Sync ke GAS agar Mutasi Tabungan dan Riwayat di Portal Wali terupdate
      // Fire-and-forget agar kasir tidak melambat
      if (typeof window !== 'undefined') {
        const payloadStr = JSON.stringify(data);
        const body = `action=${encodeURIComponent('simpanTransaksi')}&data=${encodeURIComponent(payloadStr)}`;
        fetch(GAS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body
        }).catch(e => console.warn("Sync GAS failed", e?.message));
      }

      return res;
    }

    // Route POS actions to Supabase
    if (action in supabaseServices) {
      return await (supabaseServices as any)[action](data);
    }

    // Fallback to GAS
    const payloadStr = JSON.stringify(data);
    const body = `action=${encodeURIComponent(action)}&data=${encodeURIComponent(payloadStr)}`;

    const response = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body
    });
    return await response.json();
  }
};
