export const ALL_PERMISSIONS = [
  "manage_sellers",
  "manage_managers",
  "onboard_customers",
  "view_customers",
  "view_inventory",
  "transfer_inventory",
  "approve_sales",
  "view_reports",
  "manage_permissions",
  "SELLER_READ",
  "SELLER_CREATE",
  "CUSTOMER_READ",
  "CUSTOMER_CREATE",
  "SALES_READ",
  "INVENTORY_READ",
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];
