export const MODULES = [
  "dashboard",
  "customers",
  "orders",
  "invoices",
  "payments",
  "expenses",
  "inventory",
  "tasks",
  "reports",
  "team",
  "settings",
  "marketing",
] as const;

export type ModuleName = (typeof MODULES)[number];

type ModulePerms = { view: boolean; create: boolean; edit: boolean; delete: boolean };

const full: ModulePerms = { view: true, create: true, edit: true, delete: true };
const viewOnly: ModulePerms = { view: true, create: false, edit: false, delete: false };
const none: ModulePerms = { view: false, create: false, edit: false, delete: false };

export const DEFAULT_PERMISSIONS: Record<string, Record<ModuleName, ModulePerms>> = {
  Owner: Object.fromEntries(MODULES.map((m) => [m, full])) as Record<ModuleName, ModulePerms>,

  Sales: {
    dashboard: viewOnly,
    customers: full,
    orders: full,
    invoices: viewOnly,
    payments: none,
    expenses: none,
    inventory: viewOnly,
    tasks: full,
    reports: { view: true, create: false, edit: false, delete: false },
    team: none,
    settings: none,
    marketing: none,
  },

  Operations: {
    dashboard: viewOnly,
    customers: none,
    orders: { view: true, create: false, edit: true, delete: false },
    invoices: none,
    payments: none,
    expenses: none,
    inventory: { view: true, create: true, edit: true, delete: false },
    tasks: full,
    reports: none,
    team: none,
    settings: none,
    marketing: none,
  },

  Accountant: {
    dashboard: viewOnly,
    customers: viewOnly,
    orders: viewOnly,
    invoices: full,
    payments: full,
    expenses: full,
    inventory: viewOnly,
    tasks: full,
    reports: full,
    team: none,
    settings: none,
    marketing: none,
  },

  Marketing: {
    dashboard: viewOnly,
    customers: viewOnly,
    orders: none,
    invoices: none,
    payments: none,
    expenses: none,
    inventory: none,
    tasks: full,
    reports: viewOnly,
    team: none,
    settings: none,
    marketing: full,
  },
};
