import { createContext, useContext } from "react";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";
export interface SessionUser { readonly name?: string; readonly email?: string; }
export interface Session {
  readonly status: SessionStatus;
  readonly user?: SessionUser;
  readonly error?: Error;
  readonly login: (returnTo?: string) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly getAccessToken: (fresh?: boolean) => Promise<string>;
}

export const SessionContext = createContext<Session | undefined>(undefined);
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === undefined) throw new Error("La session doit être utilisée dans son fournisseur.");
  return session;
}
