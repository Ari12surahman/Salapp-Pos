import { supabaseServices } from './supabaseServices';

export const api = {
  get: async (action: string, params: Record<string, any> = {}) => {
    // Route POS actions to Supabase
    if (action in supabaseServices) {
      return await (supabaseServices as any)[action](params.warungId);
    }
    throw new Error(`Action ${action} not found in supabaseServices`);
  },
  post: async (action: string, data: any) => {
    // Special handling for simpanTransaksi
    if (action === 'simpanTransaksi') {
      return await supabaseServices.simpanTransaksiOffline(data);
    }

    // Route POS actions to Supabase
    if (action in supabaseServices) {
      return await (supabaseServices as any)[action](data);
    }

    throw new Error(`Action ${action} not found in supabaseServices`);
  }
};
