export {};

declare global {
  // Added to the Clerk session token via Clerk Dashboard → Sessions → Customize session token:
  // { "metadata": "{{user.public_metadata}}" }
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: "staff" | "admin";
      services?: string[];
    };
  }
}
