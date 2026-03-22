export const API_BASE_URL: string =
  (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:3000';
