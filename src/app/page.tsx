"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  getPresentations,
  createPresentation,
  deletePresentation,
  createSession,
  seedSampleQuizIfEmpty,
} from "@/lib/api";
import { Presentation } from "@/lib/types";

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
  onDelete,
  onStart,
  starting,
}: {
  pres: Presentation;
  onDelete: (id: string) => void;
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
        <div>
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
        <Link href={`/editor/${pres.id}`} className="btn btn-secondary" style={{ padding: "0.85rem 1rem" }}>
          <Pencil size={14} />
        </Link>
        <button
          className="btn btn-secondary"
          style={{ padding: "0.85rem 1rem" }}
          onClick={() => onDelete(pres.id)}
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

  async function handleDelete(id: string) {
    if (confirm("Delete this presentation?")) {
      await deletePresentation(id);
      setPresentations((p) => p.filter((x) => x.id !== id));
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active="Dashboard" />

      {/* Main content */}
      <main style={{ flex: 1, padding: "2rem 2.5rem 4rem", overflowY: "auto" }}>
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
                onDelete={handleDelete}
                onStart={handleStart}
                starting={startingId === pres.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
