export function getViteGoogleClientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  return id?.trim() || null;
}
