import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { Pool } from "pg";

// Only these emails can sign up/sign in
const ALLOWED_EMAILS = [
  "tbrown034@gmail.com",
  "trevorbrown.web@gmail.com",
];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Check if user's email is in the allowlist
          const email = user.email?.toLowerCase();
          if (!email || !ALLOWED_EMAILS.includes(email)) {
            throw new APIError("FORBIDDEN", {
              message: "Access restricted to authorized users only",
            });
          }
          return { data: user };
        },
      },
    },
  },
});
