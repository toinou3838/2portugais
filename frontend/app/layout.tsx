import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const buildSafePublishableKey =
  "pk_test_YnJpZ2h0LWhhcmUtNy5jbGVyay5hY2NvdW50cy5kZXYk";

export const metadata: Metadata = {
  title: "O Mestre do Português",
  description:
    "Quiz de portugais premium avec Clerk, Next.js, FastAPI et Postgres.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? buildSafePublishableKey
      }
      appearance={{
        variables: {
          colorPrimary: "#163229",
          colorBackground: "#fffaf2",
          colorText: "#163229",
          colorInputBackground: "#fffdf9",
          colorInputText: "#163229",
          borderRadius: "1rem",
          fontFamily: "var(--font-sans)",
        },
        elements: {
          card: "shadow-card border border-[rgba(22,50,41,0.08)]",
          socialButtonsBlockButton:
            "border border-[rgba(22,50,41,0.12)] bg-white hover:bg-[#f6efe3]",
          formButtonPrimary:
            "bg-[#163229] hover:bg-[#21453a] text-white shadow-none",
          footerActionLink: "text-[#b9773f] hover:text-[#9e6230]",
        },
      }}
    >
      <html lang="fr">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
