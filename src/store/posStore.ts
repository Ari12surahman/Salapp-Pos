import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  category: string;
  warungId?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

interface PosState {
  cart: CartItem[];
  santriId: string | null;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setSantriId: (id: string | null) => void;
  getCartTotal: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  santriId: null,

  addToCart: (product) => {
    set((state) => {
      const existing = state.cart.find(item => item.id === product.id);
      if (existing) {
        return {
          cart: state.cart.map(item => 
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          )
        };
      }
      return { cart: [...state.cart, { ...product, quantity: 1 }] };
    });
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter(item => item.id !== productId)
    }));
  },

  updateQuantity: (productId, quantity) => {
    set((state) => ({
      cart: state.cart.map(item => 
        item.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    }));
  },

  clearCart: () => set({ cart: [], santriId: null }),

  setSantriId: (id) => set({ santriId: id }),

  getCartTotal: () => {
    return get().cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}));
