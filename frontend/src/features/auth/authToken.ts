const OFFICER_TOKEN_KEY = "respirawatch-officer-token";

export const getOfficerToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(OFFICER_TOKEN_KEY);
};

export const setOfficerToken = (token: string): void => {
  window.sessionStorage.setItem(OFFICER_TOKEN_KEY, token);
};

export const clearOfficerToken = (): void => {
  window.sessionStorage.removeItem(OFFICER_TOKEN_KEY);
};
