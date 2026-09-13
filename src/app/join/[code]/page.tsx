"use client";
// Deep-link join page — /join/[code]
// QR codes point here, pre-filling the session code automatically.

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function JoinWithCodePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  // Redirect to /join with code pre-filled via query param
  useEffect(() => {
    router.replace(`/join?code=${code}`);
  }, [code, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        style={{
          padding: "0.5rem 1.5rem",
          border: "var(--border-default)",
          background: "var(--color-brand-yellow)",
          fontFamily: "var(--font-display)",
          fontSize: "2.5rem",
          letterSpacing: "0.18em",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {code}
      </div>
      <p style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>
        Redirecting you to the quiz…
      </p>
    </div>
  );
}
