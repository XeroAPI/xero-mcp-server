export function getContactRoleLabel(
  isCustomer?: boolean,
  isSupplier?: boolean,
): string {
  return (
    [
      isCustomer ? "Customer" : null,
      isSupplier ? "Supplier" : null,
    ]
      .filter(Boolean)
      .join(", ") || "Unknown"
  );
}
