
import { User, UserRole, Order, ChatMessage, DiscountOffer } from './types';
import { STAFF_EMAIL, ADMIN_EMAIL } from './constants.tsx';

const USERS_KEY = 'rays_laund_users';
const ORDERS_KEY = 'rays_laund_orders';
const CHATS_KEY = 'rays_laund_chats';
const DISCOUNTS_KEY = 'rays_laund_discounts';

const notifyUpdate = () => {
  window.dispatchEvent(new Event('rays_store_update'));
};

// Initialize default admin/staff if not exist
const initializeBaseData = () => {
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  
  if (!users.find((u: any) => u.email === STAFF_EMAIL)) {
    users.push({
      id: 'staff-1',
      fullName: 'Ray Staff',
      email: STAFF_EMAIL,
      password: 'admin@staff',
      role: UserRole.STAFF
    });
  }
  
  if (!users.find((u: any) => u.email === ADMIN_EMAIL)) {
    users.push({
      id: 'admin-1',
      fullName: 'Ray Admin',
      email: ADMIN_EMAIL,
      password: 'admin@rayslaund',
      role: UserRole.ADMIN
    });
  }
  
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

initializeBaseData();

export const Store = {
  getUsers: (): User[] => JSON.parse(localStorage.getItem(USERS_KEY) || '[]'),
  saveUser: (user: User) => {
    const users = Store.getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    notifyUpdate();
  },
  updateUser: (userId: string, updates: Partial<User>) => {
    const users = Store.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      const updatedUser = { ...users[idx], ...updates };
      users[idx] = updatedUser;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      // Sync with current session if applicable
      const session = localStorage.getItem('logged_in_user');
      if (session) {
        const currentUser = JSON.parse(session);
        if (currentUser.id === userId) {
          localStorage.setItem('logged_in_user', JSON.stringify(updatedUser));
        }
      }
      
      notifyUpdate();
      return true;
    }
    return false;
  },
  findUserByEmail: (email: string) => Store.getUsers().find(u => u.email === email),
  
  getOrders: (): Order[] => JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'),
  saveOrder: (order: Order) => {
    const orders = Store.getOrders();
    orders.push(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    notifyUpdate();
  },
  updateOrder: (orderId: string, updates: Partial<Order>) => {
    const orders = Store.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...updates };
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      notifyUpdate();
    }
  },

  getChats: (userId: string): ChatMessage[] => {
    const allChats = JSON.parse(localStorage.getItem(CHATS_KEY) || '{}');
    return allChats[userId] || [];
  },
  saveChat: (userId: string, message: ChatMessage) => {
    const allChats = JSON.parse(localStorage.getItem(CHATS_KEY) || '{}');
    if (!allChats[userId]) allChats[userId] = [];
    allChats[userId].push(message);
    localStorage.setItem(CHATS_KEY, JSON.stringify(allChats));
    notifyUpdate();
  },
  updateChatHistory: (userId: string, history: ChatMessage[]) => {
    const allChats = JSON.parse(localStorage.getItem(CHATS_KEY) || '{}');
    allChats[userId] = history;
    localStorage.setItem(CHATS_KEY, JSON.stringify(allChats));
    notifyUpdate();
  },

  getDiscounts: (userId?: string): DiscountOffer[] => {
    const all = JSON.parse(localStorage.getItem(DISCOUNTS_KEY) || '[]');
    return userId ? all.filter((d: any) => d.userId === userId) : all;
  },
  saveDiscount: (discount: DiscountOffer) => {
    const all = Store.getDiscounts();
    all.push(discount);
    localStorage.setItem(DISCOUNTS_KEY, JSON.stringify(all));
    notifyUpdate();
  }
};
