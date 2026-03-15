export const ADMIN_EMAIL = "lucyonthegroundwithrocks@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
