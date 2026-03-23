/**
 * Cognito Auth Hook
 *
 * Cognito uses the SRP (Secure Remote Password) protocol. The password
 * NEVER leaves the browser — instead, a cryptographic proof is computed
 * locally and sent to Cognito.
 *
 * The token flow:
 * 1. User signs in with email + password
 * 2. Cognito validates the SRP proof
 * 3. Cognito returns 3 tokens:
 *    - ID Token: JWT containing user claims (email, sub, etc.)
 *    - Access Token: JWT used to authorize API calls.
 *    - Refresh Token: Long-lived token (30 days) used to get
 *      new ID/Access tokens when they expire (1 hour).
 *
 * The `amazon-cognito-identity-js` library handles all of this —
 * SRP math, token storage (localStorage), automatic refresh, etc.
 *
 * The sign-up flow:
 * 1. User provides email + password
 * 2. Cognito sends a 6-digit verification code to the email
 * 3. User enters the code to confirm
 * 4. User can now sign in
 *
 * "sub" is the unique user ID that Cognito assigns. It's a UUID
 * that never changes, even if the user changes their email.
 */

import { useState, useEffect, useCallback } from "react";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { config } from "../config";

const userPool = new CognitoUserPool({
  UserPoolId: config.userPoolId,
  ClientId: config.userPoolClientId,
});

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; userId: string; email: string };

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);

  // Check for an existing session on mount.
  // Cognito stores tokens in localStorage automatically.
  // getCurrentUser() checks if there's a stored session.
  // getSession() validates the tokens and refreshes if expired.
  useEffect(() => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session?.isValid()) {
            setAuthState({ status: "signedOut" });
          } else {
            const payload = session.getIdToken().decodePayload();
            setAuthState({
              status: "signedIn",
              userId: payload.sub,
              email: payload.email,
            });
          }
        }
      );
    } else {
      queueMicrotask(() => setAuthState({ status: "signedOut" }));
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      return new Promise((resolve) => {
        const attributes = [
          new CognitoUserAttribute({ Name: "email", Value: email }),
        ];

        userPool.signUp(email, password, attributes, [], (err) => {
          if (err) {
            setError(err.message);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    },
    []
  );

  const confirmSignUp = useCallback(
    async (email: string, code: string): Promise<boolean> => {
      setError(null);
      return new Promise((resolve) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });

        cognitoUser.confirmRegistration(code, true, (err) => {
          if (err) {
            setError(err.message);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      return new Promise((resolve) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });

        const authDetails = new AuthenticationDetails({
          Username: email,
          Password: password,
        });

        cognitoUser.authenticateUser(authDetails, {
          onSuccess: (session) => {
            const payload = session.getIdToken().decodePayload();
            setAuthState({
              status: "signedIn",
              userId: payload.sub,
              email: payload.email,
            });
            resolve(true);
          },
          onFailure: (err) => {
            setError(err.message);
            resolve(false);
          },
        });
      });
    },
    []
  );

  const signOut = useCallback(() => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.signOut();
    }
    setAuthState({ status: "signedOut" });
  }, []);

  return { authState, error, signUp, confirmSignUp, signIn, signOut, setError };
}
