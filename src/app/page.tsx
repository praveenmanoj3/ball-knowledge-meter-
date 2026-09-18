"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  Play,
  Pencil,
  Trash2,
  Layers,
  Clock,
  ChevronRight,
  Trophy,
  Zap,
  Loader2,
  Lock,
  KeyRound,
  X,
  ShieldAlert,
} from "lucide-react";
import {
  getPresentations,
  createPresentation,
  deletePresentation,
  createSession,
  seedSampleQuizIfEmpty,
} from "@/lib/api";
import { Presentation } from "@/lib/types";

const SECURITY_PIN = "2319";

// ── PIN Verification Modal ─────────────────────────────
function PinVerificationModal({
  isOpen,
  actionType,
  presentation,
  onSuccess,
  onClose,
}: {
  isOpen: boolean;
  actionType: "open" | "delete";
  presentation: Presentation | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (isOpen) {
      setDigits(["", "", "", ""]);
      setError(false);
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen || !presentation) return null;

  const handleDigitChange = (index: number, value: string) => {
    // Handle pasting 4-digit string
    if (value.length > 1) {
      const clean = value.replace(/\D/g, "").slice(0, 4);
      if (clean.length > 0) {
        const nextDigits = ["", "", "", ""];
        clean.split("").forEach((ch, idx) => {
          if (idx < 4) nextDigits[idx] = ch;
        });
        setDigits(nextDigits);
        setError(false);
        if (clean.length === 4) {
          if (clean === SECURITY_PIN) {
            onSuccess();
          } else {
            triggerError();
          }
        } else {
          const nextIdx = Math.min(clean.length, 3);
          inputRefs[nextIdx].current?.focus();
        }
        return;
      }
    }

    const char = value.slice(-1).replace(/\D/g, "");
    const nextDigits = [...digits];
    nextDigits[index] = char;
    setDigits(nextDigits);
    setError(false);

    if (char && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto verify when 4th digit entered
    if (char && index === 3) {
      const fullPin = nextDigits.join("");
      if (fullPin === SECURITY_PIN) {
        onSuccess();
      } else {
        triggerError();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      handleManualSubmit();
    }
  };

  const triggerError = () => {
    setError(true);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    setDigits(["", "", "", ""]);
    setTimeout(() => {
      inputRefs[0].current?.focus();
    }, 100);
  };

  const handleManualSubmit = () => {
    const fullPin = digits.join("");
    if (fullPin === SECURITY_PIN) {
      onSuccess();
    } else {
      triggerError();
    }
  };

  const isDelete = actionType === "delete";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(18, 16, 15, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        className="pin-card animate-scale-in"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: "2rem",
          background: "var(--color-surface)",
          boxShadow: "10px 10px 0 0 var(--color-shadow)",
          borderRadius: 14,
          transform: shaking ? "translateX(-6px)" : "none",
          transition: "transform 0.08s ease-in-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: isDelete ? "var(--color-brand-pink)" : "var(--color-brand-yellow)",
                border: "var(--border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {isDelete ? <ShieldAlert size={18} color="#fff" /> : <Lock size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--color-text-strong)" }}>
                {isDelete ? "Security Check: Delete" : "Security Check: Open"}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-muted)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Prompt description */}
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.92rem", color: "var(--color-text)", lineHeight: 1.45 }}>
          Enter the 4-digit host PIN to {isDelete ? <strong style={{ color: "#dc2626" }}>permanently delete</strong> : <strong>open & edit</strong>}{" "}
          &ldquo;<strong>{presentation.title}</strong>&rdquo;.
        </p>

        {/* 4 Digit Boxes */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "1.2rem" }}>
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={inputRefs[idx]}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              style={{
                width: "58px",
                height: "64px",
                fontSize: "2rem",
                textAlign: "center",
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                border: error ? "3px solid #dc2626" : "var(--border-default)",
                borderRadius: 10,
                background: error ? "#fef2f2" : "var(--color-surface-soft)",
                boxShadow: error ? "0 0 0 2px rgba(220,38,38,0.2)" : "var(--shadow-sm)",
                color: "var(--color-text-strong)",
                outline: "none",
              }}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p
            style={{
              margin: "0 0 1.2rem",
              textAlign: "center",
              fontSize: "0.85rem",
              fontWeight: 800,
              color: "#dc2626",
            }}
          >
            ❌ Incorrect PIN code. Please try again.
          </p>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className={isDelete ? "btn btn-secondary" : "btn btn-primary"}
            onClick={handleManualSubmit}
            style={{
              flex: 1.3,
              background: isDelete ? "#dc2626" : undefined,
              color: isDelete ? "#fff" : undefined,
              borderColor: isDelete ? "#991b1b" : undefined,
            }}
          >
            <KeyRound size={16} />
            Verify PIN
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────
function Sidebar({ active }: { active: string }) {
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Layers, label: "Presentations", href: "/" },
    { icon: Trophy, label: "Leaderboards", href: "/" },
    { icon: Zap, label: "Live Sessions", href: "/join" },
  ];

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brand__mark" />
        <span className="brand__text">BKM</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`sidebar-item ${item.label === active ? "sidebar-item--active" : ""}`}
          >
            <span className="sidebar-item__icon">
              <item.icon size={14} />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Database status card */}
      <div
        className="pin-card rotate-neg-1"
        style={{ marginTop: "auto", padding: "1.1rem" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          <p
            style={{
              margin: 0,
              fontSize: "0.72rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-text-muted)",
            }}
          >
            Supabase Live
          </p>
        </div>
        <div
          style={{
            fontSize: "1.8rem",
            fontFamily: "var(--font-display)",
            color: "var(--color-text-strong)",
            lineHeight: 1,
            marginTop: "0.3rem",
          }}
        >
          200+ Cap
        </div>
        <p
          style={{
            margin: "0.3rem 0 0",
            fontSize: "0.83rem",
            lineHeight: 1.4,
            color: "var(--color-text-muted)",
          }}
        >
          Realtime audience synchronization active
        </p>
      </div>
    </aside>
  );
}

// ── Presentation Card ──────────────────────────────────
function PresentationCard({
  pres,
  onOpen,
  onDelete,
  onStart,
  starting,
}: {
  pres: Presentation;
  onOpen: (pres: Presentation) => void;
  onDelete: (pres: Presentation) => void;
  onStart: (id: string) => void;
  starting: boolean;
}) {
  const formattedDate = new Date(pres.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <article
      className="pin-card animate-fade-up"
      style={{ padding: "1.4rem" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ cursor: "pointer" }} onClick={() => onOpen(pres)}>
          <h3
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 800,
              color: "var(--color-text-strong)",
              lineHeight: 1.3,
            }}
          >
            {pres.title}
          </h3>
          {pres.description && (
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              {pres.description}
            </p>
          )}
        </div>
      </div>

      {/* Meta */}
      <div
        style={{
          display: "flex",
          gap: "1.2rem",
          marginBottom: "1.2rem",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "var(--color-text-muted)",
          }}
        >
          <Layers size={13} />
          {pres.slides_count || 1} slides
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "var(--color-text-muted)",
          }}
        >
          <Clock size={13} />
          {formattedDate}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button
          onClick={() => onStart(pres.id)}
          disabled={starting}
          className="btn btn-green"
          style={{ flex: 1, minWidth: 100 }}
        >
          {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Start Live
        </button>
        <button
          onClick={() => onOpen(pres)}
          className="btn btn-secondary"
          style={{ padding: "0.85rem 1rem" }}
          title="Open / Edit Presentation (PIN Required)"
        >
          <Pencil size={14} />
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: "0.85rem 1rem" }}
          onClick={() => onDelete(pres)}
          title="Delete Presentation (PIN Required)"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

// ── Dashboard Page ─────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  // PIN security state
  const [pinModal, setPinModal] = useState<{
    isOpen: boolean;
    actionType: "open" | "delete";
    presentation: Presentation | null;
  }>({
    isOpen: false,
    actionType: "open",
    presentation: null,
  });

  useEffect(() => {
    async function initData() {
      try {
        await seedSampleQuizIfEmpty();
        const data = await getPresentations();
        setPresentations(data);
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  async function handleCreate() {
    setCreating(true);
    const newId = await createPresentation("My New Live Quiz", "Interactive 200-person live presentation");
    if (newId) {
      router.push(`/editor/${newId}`);
    } else {
      setCreating(false);
    }
  }

  async function handleStart(id: string) {
    setStartingId(id);
    const session = await createSession(id);
    if (session) {
      router.push(`/host/${session.id}`);
    } else {
      setStartingId(null);
      alert("Failed to start session. Please verify database connection.");
    }
  }

  function handleRequestOpen(pres: Presentation) {
    setPinModal({
      isOpen: true,
      actionType: "open",
      presentation: pres,
    });
  }

  function handleRequestDelete(pres: Presentation) {
    setPinModal({
      isOpen: true,
      actionType: "delete",
      presentation: pres,
    });
  }

  async function handlePinSuccess() {
    if (!pinModal.presentation) return;
    const pres = pinModal.presentation;
    const action = pinModal.actionType;

    setPinModal({ isOpen: false, actionType: "open", presentation: null });

    if (action === "open") {
      router.push(`/editor/${pres.id}`);
    } else if (action === "delete") {
      await deletePresentation(pres.id);
      setPresentations((prev) => prev.filter((x) => x.id !== pres.id));
    }
  }

  function handleClosePinModal() {
    setPinModal({ isOpen: false, actionType: "open", presentation: null });
  }

  return (
    <div className="app-layout" style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active="Dashboard" />

      {/* Main content */}
      <main className="main-content" style={{ flex: 1, padding: "2rem 2.5rem 4rem", overflowY: "auto" }}>
        {/* Page header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "2.5rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 0.25rem",
                fontSize: "0.78rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--color-text-muted)",
              }}
            >
              Host Workspace
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: "2.2rem",
                fontWeight: 800,
                fontFamily: "var(--font-display)",
                color: "var(--color-text-strong)",
                lineHeight: 1.15,
              }}
            >
              Presentations
            </h1>
          </div>

          <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <Link href="/join" className="btn btn-secondary">
              <Zap size={15} />
              Join as Player
            </Link>
            <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              New Presentation
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "5rem 0" }}>
            <div className="pin-card" style={{ padding: "2rem 3rem", textAlign: "center" }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 1rem", color: "var(--color-accent-amber)" }} />
              <p style={{ fontWeight: 800, margin: 0 }}>Connecting to Supabase...</p>
            </div>
          </div>
        ) : presentations.length === 0 ? (
          <div className="pin-card" style={{ padding: "3rem", textAlign: "center", maxWidth: 500, margin: "2rem auto" }}>
            <Layers size={48} style={{ margin: "0 auto 1rem", color: "var(--color-accent-amber)" }} />
            <h3 style={{ fontWeight: 800, margin: "0 0 0.5rem" }}>No presentations yet</h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>Create your first quiz presentation to start hosting live sessions!</p>
            <button onClick={handleCreate} className="btn btn-primary" style={{ margin: "0 auto" }}>
              <Plus size={16} /> Create Presentation
            </button>
          </div>
        ) : (
          /* Grid */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {presentations.map((pres) => (
              <PresentationCard
                key={pres.id}
                pres={pres}
                onOpen={handleRequestOpen}
                onDelete={handleRequestDelete}
                onStart={handleStart}
                starting={startingId === pres.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* PIN Verification Security Modal */}
      <PinVerificationModal
        isOpen={pinModal.isOpen}
        actionType={pinModal.actionType}
        presentation={pinModal.presentation}
        onSuccess={handlePinSuccess}
        onClose={handleClosePinModal}
      />
    </div>
  );
}
