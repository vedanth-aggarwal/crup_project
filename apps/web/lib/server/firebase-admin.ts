import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { hasAdminCredentials, requireEnv } from "./env";

let app: App | undefined;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApp());
  if (!hasAdminCredentials()) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY from the clubo-berkeley service account.",
    );
  }
  app = initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      // Vercel/.env store the key with literal \n sequences.
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

let firestore: Firestore | undefined;
export function adminDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(adminApp());
    try {
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Another bundle of this module already configured the shared instance.
    }
  }
  return firestore;
}

export const adminAuth = () => getAuth(adminApp());
