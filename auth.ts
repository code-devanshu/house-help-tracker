import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // 1. Get the list of allowed emails from your secret .env
      const allowedString = process.env.ADMIN_EMAILS || "";
      const allowedEmails = allowedString
        .split(",")
        .map((e) => e.trim().toLowerCase());

      // 2. Check if the Google email is in your allowed list
      const isAllowed =
        user.email && allowedEmails.includes(user.email.toLowerCase());

      if (isAllowed) {
        return true; // Login allowed
      } else {
        // 3. Return false to deny access (redirects to /api/auth/error?error=AccessDenied)
        return false;
      }
    },
  },
  session: { strategy: "jwt" },
};
