export function formatMoney(paise = "0") {
  const amount = BigInt(paise);
  const rupees = amount / 100n;
  const fraction = String(amount % 100n).padStart(2, "0");
  return `₹${new Intl.NumberFormat("en-IN").format(rupees)}.${fraction}`;
}
