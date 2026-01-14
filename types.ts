
export enum UserRole {
  CUSTOMER = 'customer',
  STAFF = 'staff',
  ADMIN = 'admin'
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  discountCount?: number;
  orderCount?: number;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PICKING_UP = 'PICKING_UP',
  WASHING = 'WASHING',
  DELIVERY = 'DELIVERY',
  DELIVERED = 'DELIVERED'
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  completedAt?: string;
  pickupLocation?: { lat: number; lng: number; address: string };
  staffId?: string;
  deliveryCode?: string;
  confirmedByCustomer?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isAI: boolean;
  needsAdmin: boolean;
  isTakenOverByAdmin?: boolean;
}

export interface DiscountOffer {
  id: string;
  userId: string;
  amount: number;
  message: string;
  claimed: boolean;
}
