export type ModuleName =
  | "dashboard"
  | "customers"
  | "orders"
  | "invoices"
  | "payments"
  | "expenses"
  | "inventory"
  | "tasks"
  | "reports"
  | "team"
  | "settings"
  | "marketing";

export type ModulePermission = { view: boolean; create: boolean; edit: boolean; delete: boolean };
export type Permissions = Record<ModuleName, ModulePermission>;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
}

export interface Customer {
  id: string;
  businessName: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  customerType: string;
  leadSource: string;
  interestLevel: string;
  status: string;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name: string } | null;
  tags: string[];
  notes?: string | null;
  lastContactedAt?: string | null;
  nextFollowupAt?: string | null;
  lostReason?: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  productName: string;
  productType: string;
  bagSize: string;
  sku: string;
  stockBags: number;
  stockKg: string;
  costPrice: string;
  wholesalePrice: string;
  lowStockLevel: number;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  product?: Product;
  quantityBags: number;
  quantityKg: string;
  pricePerKg: string;
  pricePerBag: string;
  subtotal: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customer?: { businessName: string };
  contactPerson?: string | null;
  deliveryAddress?: string | null;
  deliveryDate?: string | null;
  deliveryNotes?: string | null;
  paymentStatus: string;
  orderStatus: string;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name: string } | null;
  invoiceId?: string | null;
  discount: string;
  gstApplicable: boolean;
  totalValue: string;
  items: OrderItem[];
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId?: string | null;
  customerId: string;
  customer?: { businessName: string };
  subtotal: string;
  gstAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  dueDate?: string | null;
  paymentTerms?: string | null;
  status: string;
  items?: { id: string; description: string; quantity: string; unitPrice: string; subtotal: string }[];
  payments?: Payment[];
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNote?: string | null;
  customer?: { businessName: string };
  invoice?: { invoiceNumber: string };
  recorder?: { name: string };
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  supplierName?: string | null;
  amount: string;
  gstIncluded: boolean;
  paymentMethod?: string | null;
  receiptFileUrl?: string | null;
  notes?: string | null;
  enteredByUser?: { name: string };
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  assignedTo?: string | null;
  assignee?: { id: string; name: string } | null;
  priority: string;
  dueDate?: string | null;
  status: string;
  relatedType?: string | null;
  relatedId?: string | null;
  recurrence: string;
  notes?: string | null;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  relatedType?: string | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Settings {
  id: number;
  businessName: string;
  abn?: string | null;
  businessAddress?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  bankDetails?: string | null;
  gstRegistered: boolean;
  defaultPaymentTerms?: string | null;
  invoicePrefix: string;
  quotePrefix: string;
  orderPrefix: string;
  expenseCategories: string[];
  productTypes: string[];
  emailTemplates: Record<string, { subject: string; body: string }>;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  roleId: number;
  isActive: boolean;
  lastLoginAt?: string | null;
}
