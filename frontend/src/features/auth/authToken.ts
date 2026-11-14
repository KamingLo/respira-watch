const OFFICER_TOKEN_KEY = "respirawatch-officer-token";
const OFFICER_TOKEN_CHANGE_EVENT = "respirawatch-officer-token-change";

export const getOfficerToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(OFFICER_TOKEN_KEY);
};

export const setOfficerToken = (token: string): void => {
  window.sessionStorage.setItem(OFFICER_TOKEN_KEY, token);
  window.dispatchEvent(new Event(OFFICER_TOKEN_CHANGE_EVENT));
};

export const clearOfficerToken = (): void => {
  window.sessionStorage.removeItem(OFFICER_TOKEN_KEY);
  window.dispatchEvent(new Event(OFFICER_TOKEN_CHANGE_EVENT));
};

export const subscribeOfficerToken = (callback: () => void): (() => void) => {
  window.addEventListener(OFFICER_TOKEN_CHANGE_EVENT, callback);
  return () => window.removeEventListener(OFFICER_TOKEN_CHANGE_EVENT, callback);
};

export const hasOfficerTokenSnapshot = (): boolean =>
  Boolean(getOfficerToken());
