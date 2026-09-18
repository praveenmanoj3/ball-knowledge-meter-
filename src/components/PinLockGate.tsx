"use client";

import { useState, useEffect, useRef } from "react";
import { Lock, Unlock, ArrowRight, Delete, ShieldAlert } from "lucide-react";

const REQUIRED_PIN = "2319";
const STORAGE_KEY = "bkm_app_unlocked";

export default function PinLockGate({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === REQUIRED_PIN) {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(false);
    }
  }, []);

  useEffect(() => {
    if (isUnlocked === false) {
      hiddenInputRef.current?.focus();
    }
  }, [isUnlocked]);

  const handleDigit = (digit: string) => {
    if (success || pin.length >= 4) return;
    setError(false);
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      verifyPin(newPin);
    }
  };

  const handleBackspace = () => {
    if (success) return;
    setError(false);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (success) return;
    setError(false);
    setPin("");
  };

  const verifyPin = (candidatePin: string) => {
    if (candidatePin === REQUIRED_PIN) {
      setSuccess(true);
      setError(false);
      localStorage.setItem(STORAGE_KEY, REQUIRED_PIN);
      setTimeout(() => {
        setIsUnlocked(true);
      }, 400);
    } else {
      setError(true);
      if (typeof window !== "undefined" && window.navigator?.vibrate) {
        window.navigator.vibrate(200);
      }
      setTimeout(() => {
        setPin("");
      }, 600);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isUnlocked || success) return;

    if (e.key >= "0" && e.key <= "9") {
      handleDigit(e.key);
    } else if (e.key === "Backspace") {
      handleBackspace();
    } else if (e.key === "Enter" && pin.length === 4) {
      verifyPin(pin);
    } else if (e.key === "Escape") {
      handleClear();
    }
  };

  // Prevent flash while checking localStorage
  if (isUnlocked === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-bg)",
        }}
      >
        <div className="brand" style={{ transform: "scale(1.2)" }}>
          <div className="brand__mark" />
          <span className="brand__text">BKM</span>
        </div>
      </div>
    );
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => hiddenInputRef.current?.focus()}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        outline: "none",
        userSelect: "none",
      }}
    >
      {/* Hidden input to ensure soft keyboard opens on mobile if tapped */}
      <input
        ref={hiddenInputRef}
        type="tel"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "").slice(0, 4);
          setPin(val);
          setError(false);
          if (val.length === 4) {
            verifyPin(val);
          }
        }}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1,
        }}
        autoFocus
      />

      <div
        className={`pin-card ${error ? "animate-shake" : "animate-fade-up"}`}
        style={{
          maxWidth: 400,
          width: "100%",
          padding: "2.2rem 1.8rem 1.8rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          background: "var(--color-surface)",
        }}
      >
        {/* Brand & Lock Icon */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <div className="brand" style={{ marginBottom: "0.3rem" }}>
            <div className="brand__mark" />
            <span className="brand__text">BKM</span>
          </div>

          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: success
                ? "var(--color-brand-green)"
                : error
                ? "var(--color-brand-pink)"
                : "var(--color-brand-yellow)",
              border: "var(--border-default)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 200ms ease",
            }}
          >
            {success ? (
              <Unlock size={24} color="#ffffff" />
            ) : error ? (
              <ShieldAlert size={24} color="#ffffff" />
            ) : (
              <Lock size={24} color="var(--color-text-strong)" />
            )}
          </div>

          <h2
            style={{
              margin: "0.2rem 0 0",
              fontFamily: "var(--font-display)",
              fontSize: "1.75rem",
              color: "var(--color-text-strong)",
              textAlign: "center",
            }}
          >
            {success ? "Access Granted" : "Restricted Access"}
          </h2>

          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              fontWeight: 600,
              color: error ? "var(--color-brand-pink)" : "var(--color-text-muted)",
              textAlign: "center",
            }}
          >
            {error
              ? "Incorrect PIN. Please try again."
              : success
              ? "Opening BallKnowledgeMeter..."
              : "Enter 4-digit PIN to unlock"}
          </p>
        </div>

        {/* 4 PIN Dots / Digit Boxes */}
        <div
          style={{
            display: "flex",
            gap: "0.8rem",
            justifyContent: "center",
            margin: "0.4rem 0",
          }}
        >
          {[0, 1, 2, 3].map((index) => {
            const hasValue = pin.length > index;
            const isCurrent = pin.length === index;
            return (
              <div
                key={index}
                style={{
                  width: 50,
                  height: 58,
                  border: isCurrent
                    ? "3px solid var(--color-brand-yellow)"
                    : error
                    ? "3px solid var(--color-brand-pink)"
                    : success
                    ? "3px solid var(--color-brand-green)"
                    : "var(--border-default)",
                  background: hasValue ? "var(--color-surface-soft)" : "var(--color-surface-muted)",
                  boxShadow: hasValue ? "var(--shadow-sm)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  color: "var(--color-text-strong)",
                  transition: "all 120ms ease",
                }}
              >
                {hasValue ? "●" : ""}
              </div>
            );
          })}
        </div>

        {/* Number Keypad */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.55rem",
            width: "100%",
            maxWidth: 280,
          }}
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDigit(num);
              }}
              className="btn btn-secondary"
              style={{
                padding: "0.75rem",
                fontSize: "1.25rem",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                minHeight: 48,
              }}
            >
              {num}
            </button>
          ))}

          {/* Clear / Backspace */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="btn btn-secondary"
            style={{
              padding: "0.75rem",
              fontSize: "0.75rem",
              fontWeight: 800,
              minHeight: 48,
            }}
          >
            CLR
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDigit("0");
            }}
            className="btn btn-secondary"
            style={{
              padding: "0.75rem",
              fontSize: "1.25rem",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              minHeight: 48,
            }}
          >
            0
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBackspace();
            }}
            className="btn btn-secondary"
            style={{
              padding: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
            }}
          >
            <Delete size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
