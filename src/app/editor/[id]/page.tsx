"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  GripVertical,
  Upload,
  CheckCircle,
  ImageIcon,
  Video,
  ChevronLeft,
  Play,
  Copy,
  Loader2,
  X,
  FileImage,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  getPresentation,
  createPresentation,
  savePresentationSlides,
  updatePresentationDetails,
  createSession,
  ensureStorageBucket,
  uploadSlideMedia,
} from "@/lib/api";
import { Slide } from "@/lib/types";

type MediaType = "none" | "image" | "gif" | "video";

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_COLORS = [
  "var(--color-brand-blue)",
  "var(--color-brand-green)",
  "var(--color-brand-yellow)",
  "var(--color-brand-pink)",
];

function createDefaultSlide(orderIdx: number): Slide {
  return {
    id: `temp-${Date.now()}-${orderIdx}`,
    presentation_id: "",
    order_index: orderIdx,
    type: "mcq",
    question: "Enter your question here...",
    description: "",
    media_url: "",
    media_type: "none",
    time_limit: 20,
    preview_time: 5,
    points_multiplier: 1,
    options: [
      { id: `opt-0-${orderIdx}`, order_index: 0, text: "Option A", is_correct: true },
      { id: `opt-1-${orderIdx}`, order_index: 1, text: "Option B", is_correct: false },
      { id: `opt-2-${orderIdx}`, order_index: 2, text: "Option C", is_correct: false },
      { id: `opt-3-${orderIdx}`, order_index: 3, text: "Option D", is_correct: false },
    ],
  };
}

// ── Slide Thumbnail ─────────────────────────────────────
function SlideThumbnail({
  slide,
  index,
  total,
  active,
  onClick,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  slide: Slide;
  index: number;
  total: number;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={`slide-thumb ${active ? "slide-thumb--active" : ""}`}
      onClick={onClick}
      style={{ position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.4rem" }}>
        <GripVertical size={12} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
          Slide {index + 1}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "2px" }}>
          {index > 0 && (
            <button
              title="Move Up"
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--color-text-muted)" }}
            >
              <ChevronUp size={13} />
            </button>
          )}
          {index < total - 1 && (
            <button
              title="Move Down"
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--color-text-muted)" }}
            >
              <ChevronDown size={13} />
            </button>
          )}
          <button
            title="Delete Slide"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--color-text-muted)", marginLeft: "2px" }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Media thumbnail preview */}
      {slide.media_url && (
        <div style={{ width: "100%", height: 45, marginBottom: "0.3rem", overflow: "hidden", border: "1px solid var(--color-border)", borderRadius: 4 }}>
          {slide.media_type === "video" ? (
            <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Video size={16} color="#fff" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
      )}

      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--color-text-strong)", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {slide.question || <span style={{ color: "var(--color-text-muted)" }}>No question yet…</span>}
      </div>
    </div>
  );
}

// ── Media Upload Zone ───────────────────────────────────
function MediaUploadZone({
  slide,
  presentationId,
  onUpdate,
}: {
  slide: Slide;
  presentationId: string;
  onUpdate: (field: Partial<Slide>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentAccept, setCurrentAccept] = useState("image/*,video/*");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const detectMediaType = (file: File): MediaType => {
    if (file.type.startsWith("video/")) return "video";
    if (file.type === "image/gif") return "gif";
    return "image";
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploadError("");
    setUploading(true);

    // 50 MB cap
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File is too large (max 50 MB).");
      setUploading(false);
      return;
    }

    const url = await uploadSlideMedia(presentationId, file);
    if (url) {
      const mediaType = detectMediaType(file);
      onUpdate({ media_url: url, media_type: mediaType });
    } else {
      setUploadError("Upload failed. Make sure 'slide-media' bucket exists in Supabase.");
    }
    setUploading(false);
  };

  const triggerPicker = (acceptTypes: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentAccept(acceptTypes);
    // Timeout to ensure state updates accept attribute before opening dialog
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 10);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ media_url: "", media_type: "none" });
  };

  // ── 1. Has media already uploaded ──────────────────────
  if (slide.media_url) {
    return (
      <div
        className="media-area"
        style={{
          position: "relative",
          padding: 0,
          overflow: "hidden",
          cursor: "default",
          maxHeight: 280,
          background: "#000",
          borderRadius: 12,
          border: "2.5px solid #000",
          boxShadow: "4px 4px 0 0 #000",
        }}
      >
        {slide.media_type === "video" ? (
          <video
            src={slide.media_url}
            controls
            style={{ width: "100%", maxHeight: 280, objectFit: "contain", background: "#000" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.media_url}
            alt="Slide media"
            style={{ width: "100%", maxHeight: 280, objectFit: "contain", background: "var(--color-surface)" }}
          />
        )}

        {/* Overlay buttons */}
        <div style={{ position: "absolute", top: "0.75rem", right: "0.75rem", display: "flex", gap: "0.5rem" }}>
          <button
            onClick={(e) => triggerPicker("image/*,video/*", e)}
            className="btn btn-secondary"
            style={{ padding: "0.35rem 0.75rem", minHeight: "unset", fontSize: "0.78rem", background: "#fff" }}
            disabled={uploading}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Replace
          </button>
          <button
            onClick={handleRemove}
            className="btn btn-pink"
            style={{ padding: "0.35rem 0.65rem", minHeight: "unset", fontSize: "0.78rem" }}
          >
            <X size={12} /> Remove
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={currentAccept}
          style={{ display: "none" }}
          onChange={handleInputChange}
        />
      </div>
    );
  }

  // ── 2. Banner Drop Zone (Matches requested mockup) ──────
  return (
    <div
      onClick={() => triggerPicker("image/*,video/*")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        cursor: "pointer",
        background: dragOver ? "rgba(251,191,36,0.12)" : "var(--color-surface)",
        border: dragOver ? "2.5px dashed var(--color-accent-amber)" : "2.5px solid #000",
        boxShadow: "4px 4px 0 0 #000",
        borderRadius: 12,
        padding: "2.5rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
        userSelect: "none",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={currentAccept}
        style={{ display: "none" }}
        onChange={handleInputChange}
      />

      {uploading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <Loader2 size={40} className="animate-spin" color="var(--color-accent-amber)" />
          <p style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem" }}>Uploading file to Supabase…</p>
        </div>
      ) : (
        <>
          <Upload size={36} color="var(--color-text-strong)" strokeWidth={2} />

          <h3 style={{ margin: "0.6rem 0 0.2rem", fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "1.15rem", color: "var(--color-text-strong)" }}>
            Media Banner (Optional)
          </h3>

          <p style={{ margin: "0 0 1.3rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--color-text-muted)" }}>
            Image · GIF · Video
          </p>

          {/* Interactive Media Type Picker Buttons */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={(e) => triggerPicker("image/jpeg,image/png,image/webp", e)}
              style={{
                background: "#ffffff",
                border: "2.5px solid #000",
                boxShadow: "3px 3px 0 0 #000",
                borderRadius: 8,
                padding: "0.5rem 1.1rem",
                fontWeight: 800,
                fontSize: "0.82rem",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                cursor: "pointer",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(2px, 2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "1px 1px 0 0 #000"; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 0 #000"; }}
            >
              <ImageIcon size={15} />
              IMAGE
            </button>

            <button
              type="button"
              onClick={(e) => triggerPicker("image/gif", e)}
              style={{
                background: "#ffffff",
                border: "2.5px solid #000",
                boxShadow: "3px 3px 0 0 #000",
                borderRadius: 8,
                padding: "0.5rem 1.1rem",
                fontWeight: 800,
                fontSize: "0.82rem",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                cursor: "pointer",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(2px, 2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "1px 1px 0 0 #000"; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 0 #000"; }}
            >
              <FileImage size={15} />
              GIF
            </button>

            <button
              type="button"
              onClick={(e) => triggerPicker("video/mp4,video/webm,video/ogg", e)}
              style={{
                background: "#ffffff",
                border: "2.5px solid #000",
                boxShadow: "3px 3px 0 0 #000",
                borderRadius: 8,
                padding: "0.5rem 1.1rem",
                fontWeight: 800,
                fontSize: "0.82rem",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                cursor: "pointer",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(2px, 2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "1px 1px 0 0 #000"; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 0 #000"; }}
            >
              <Video size={15} />
              VIDEO
            </button>
          </div>
        </>
      )}

      {uploadError && (
        <p style={{ margin: "1rem 0 0", color: "#ef4444", fontWeight: 800, fontSize: "0.88rem", textAlign: "center" }}>
          ⚠️ {uploadError}
        </p>
      )}
    </div>
  );
}

// ── Main Editor ─────────────────────────────────────────
export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const presentationId = params.id as string;

  const [title, setTitle] = useState("Loading...");
  const [slides, setSlides] = useState<Slide[]>([createDefaultSlide(0)]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    async function loadData() {
      // Ensure storage bucket exists (no-op if already present)
      await ensureStorageBucket();

      if (!presentationId || presentationId === "new") {
        setTitle("New Quiz Presentation");
        setLoading(false);
        return;
      }
      try {
        const data = await getPresentation(presentationId);
        if (data) {
          setTitle(data.presentation.title);
          setSlides(data.slides.length > 0 ? data.slides : [createDefaultSlide(0)]);
        }
      } catch (err) {
        console.error("Failed to load presentation:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [presentationId]);

  const activeSlide = slides[activeIdx] || slides[0] || createDefaultSlide(0);

  const updateSlide = useCallback(
    (field: Partial<Slide>) => {
      setSlides((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, ...field } : s)));
      setSaved(false);
    },
    [activeIdx]
  );

  const updateOptionText = (optIndex: number, text: string) => {
    const opts = [...(activeSlide.options || [])];
    if (opts[optIndex]) {
      opts[optIndex] = { ...opts[optIndex], text };
      updateSlide({ options: opts });
    }
  };

  const setCorrectOption = (optIndex: number) => {
    const opts = (activeSlide.options || []).map((o, i) => ({ ...o, is_correct: i === optIndex }));
    updateSlide({ options: opts });
  };

  const addSlide = () => {
    const newSlide = createDefaultSlide(slides.length);
    setSlides((prev) => [...prev, newSlide]);
    setActiveIdx(slides.length);
    setSaved(false);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => Math.min(prev, slides.length - 2));
    setSaved(false);
  };

  const duplicateSlide = () => {
    const copy: Slide = {
      ...activeSlide,
      id: `copy-${Date.now()}`,
      order_index: activeIdx + 1,
      options: (activeSlide.options || []).map((o) => ({ ...o, id: `opt-${Date.now()}-${o.order_index}` })),
    };
    setSlides((prev) => [...prev.slice(0, activeIdx + 1), copy, ...prev.slice(activeIdx + 1)]);
    setActiveIdx(activeIdx + 1);
    setSaved(false);
  };

  const moveSlideUp = (idx: number) => {
    if (idx <= 0) return;
    setSlides((prev) => {
      const arr = [...prev];
      const temp = arr[idx];
      arr[idx] = arr[idx - 1];
      arr[idx - 1] = temp;
      return arr;
    });
    setActiveIdx(idx - 1);
    setSaved(false);
  };

  const moveSlideDown = (idx: number) => {
    if (idx >= slides.length - 1) return;
    setSlides((prev) => {
      const arr = [...prev];
      const temp = arr[idx];
      arr[idx] = arr[idx + 1];
      arr[idx + 1] = temp;
      return arr;
    });
    setActiveIdx(idx + 1);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let targetId = presentationId;
      if (!targetId || targetId === "new") {
        const createdId = await createPresentation(title || "My Quiz", "");
        if (createdId) {
          targetId = createdId;
          router.replace(`/editor/${createdId}`);
        } else {
          alert("Failed to create presentation record in database.");
          setSaving(false);
          return;
        }
      }
      await updatePresentationDetails(targetId, { title });
      await savePresentationSlides(targetId, slides);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(`Save failed:\n\n${err?.message || String(err)}\n\nCheck browser console (F12) for full details.`);
    } finally {
      setSaving(false);
    }
  };

  const handlePresent = async () => {
    setPresenting(true);
    try {
      let targetId = presentationId;
      if (!targetId || targetId === "new") {
        const createdId = await createPresentation(title || "My Quiz", "");
        if (createdId) {
          targetId = createdId;
          router.replace(`/editor/${createdId}`);
        } else {
          alert("Failed to create presentation record in database.");
          setPresenting(false);
          return;
        }
      }
      await updatePresentationDetails(targetId, { title });
      await savePresentationSlides(targetId, slides);
      const session = await createSession(targetId);
      if (session && session.id) {
        router.push(`/host/${session.id}`);
      } else {
        alert("Failed to start live session. Please check Supabase database connection.");
        setPresenting(false);
      }
    } catch (err) {
      console.error("Present failed:", err);
      setPresenting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <div className="pin-card" style={{ padding: "2rem 3rem", textAlign: "center" }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 1rem", color: "var(--color-accent-amber)" }} />
          <p style={{ fontWeight: 800, margin: 0 }}>Loading Editor…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100vh", overflow: "hidden" }}>
      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1.25rem", borderBottom: "var(--border-default)", background: "var(--color-surface)", boxShadow: "0 3px 0 0 var(--color-shadow)", zIndex: 50, flexWrap: "wrap" }}>
        <Link href="/" className="btn btn-secondary" style={{ padding: "0.6rem 0.9rem", minHeight: "unset" }}>
          <ChevronLeft size={16} />
        </Link>

        <input
          className="input"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
          style={{ flex: 1, maxWidth: 420, padding: "0.55rem 0.8rem", fontSize: "1rem" }}
          placeholder="Quiz Title"
        />

        <div style={{ display: "flex", gap: "0.6rem", marginLeft: "auto" }}>
          <button
            className="btn btn-secondary"
            style={{ minHeight: "unset", padding: "0.6rem 1rem" }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : saved ? (
              <><CheckCircle size={14} color="#16a34a" /> Saved!</>
            ) : "Save"}
          </button>
          <button
            onClick={handlePresent}
            disabled={presenting}
            className="btn btn-green"
            style={{ minHeight: "unset", padding: "0.6rem 1rem" }}
          >
            {presenting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Present Live
          </button>
        </div>
      </header>

      {/* 3-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", overflow: "hidden" }}>

        {/* ── Left: Slide panel ── */}
        <aside style={{ borderRight: "var(--border-default)", background: "var(--color-surface-muted)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "0.75rem", borderBottom: "var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
              {slides.length} Slides
            </span>
            <button className="btn btn-primary" style={{ padding: "0.4rem 0.7rem", fontSize: "0.75rem", minHeight: "unset" }} onClick={addSlide}>
              <Plus size={12} /> Add
            </button>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {slides.map((slide, i) => (
              <SlideThumbnail
                key={slide.id || i}
                slide={slide}
                index={i}
                total={slides.length}
                active={i === activeIdx}
                onClick={() => setActiveIdx(i)}
                onDelete={() => deleteSlide(i)}
                onMoveUp={() => moveSlideUp(i)}
                onMoveDown={() => moveSlideDown(i)}
              />
            ))}
          </div>
        </aside>

        {/* ── Center: Canvas ── */}
        <main style={{ overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          {/* Slide label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>
              SLIDE {activeIdx + 1} OF {slides.length}
            </div>
            <button className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", minHeight: "unset", fontSize: "0.8rem" }} onClick={duplicateSlide}>
              <Copy size={12} /> Duplicate
            </button>
          </div>

          {/* ── Media Upload Zone ── */}
          <MediaUploadZone
            slide={activeSlide}
            presentationId={presentationId}
            onUpdate={updateSlide}
          />

          {/* Question */}
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
              Question
            </label>
            <textarea
              className="input"
              rows={2}
              value={activeSlide.question}
              onChange={(e) => updateSlide({ question: e.target.value })}
              placeholder="What is your question?"
              style={{ resize: "vertical", fontSize: "1.1rem", fontWeight: 700 }}
            />
          </div>

          {/* Options */}
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: "0.6rem" }}>
              Answer Options — click ✓ to mark correct
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
              {(activeSlide.options || []).map((opt, i) => {
                const isCorrect = opt.is_correct;
                return (
                  <div
                    key={opt.id || i}
                    className="pin-card"
                    style={{
                      padding: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      borderColor: isCorrect ? "#16a34a" : undefined,
                      boxShadow: isCorrect ? "0 4px 0 0 #15803d" : undefined,
                    }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: "50%", background: OPTION_COLORS[i % OPTION_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: "0.9rem", flexShrink: 0, border: "2px solid #000" }}>
                      {OPTION_LABELS[i]}
                    </span>
                    <input
                      className="input"
                      value={opt.text}
                      onChange={(e) => updateOptionText(i, e.target.value)}
                      placeholder={`Option ${OPTION_LABELS[i]}`}
                      style={{ flex: 1, padding: "0.45rem 0.6rem", fontSize: "0.95rem", fontWeight: 600, background: "transparent" }}
                    />
                    <button
                      onClick={() => setCorrectOption(i)}
                      title="Set as correct"
                      style={{ background: isCorrect ? "#22c55e" : "var(--color-surface-muted)", color: isCorrect ? "#fff" : "var(--color-text-muted)", border: "2px solid #000", borderRadius: "8px", cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <CheckCircle size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* ── Right: Settings ── */}
        <aside style={{ borderLeft: "var(--border-default)", background: "var(--color-surface-muted)", padding: "1.2rem", overflowY: "auto" }}>
          <h3 style={{ margin: "0 0 1.2rem", fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
            Slide Settings
          </h3>

          {/* Time limit */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
              Answer Time Limit
            </label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              {[10, 15, 20, 30, 45, 60].map((sec) => (
                <button
                  key={sec}
                  onClick={() => updateSlide({ time_limit: sec })}
                  className={`btn ${activeSlide.time_limit === sec ? "btn-yellow" : "btn-secondary"}`}
                  style={{ padding: "0.4rem 0.65rem", fontSize: "0.8rem", minHeight: "unset" }}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Question & Media Preview Time */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
              Preview Question/Media First
            </label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
              {[0, 3, 5, 10, 15].map((sec) => (
                <button
                  key={sec}
                  onClick={() => updateSlide({ preview_time: sec })}
                  className={`btn ${(activeSlide.preview_time ?? 5) === sec ? "btn-green" : "btn-secondary"}`}
                  style={{ padding: "0.4rem 0.65rem", fontSize: "0.8rem", minHeight: "unset" }}
                >
                  {sec === 0 ? "Off (0s)" : `${sec}s`}
                </button>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
              Shows question & media first before answer options pop up.
            </p>
          </div>

          {/* Media info */}
          {activeSlide.media_url && (
            <div className="pin-card" style={{ padding: "0.9rem", marginBottom: "1rem" }}>
              <p style={{ margin: "0 0 0.3rem", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                Media Stored
              </p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#16a34a", fontWeight: 700, wordBreak: "break-all" }}>
                ✓ Supabase Storage
              </p>
              <p style={{ margin: "0.3rem 0 0", fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                Type: {activeSlide.media_type?.toUpperCase()}
              </p>
            </div>
          )}

          <div className="pin-card" style={{ padding: "1rem" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
              Media Tips
            </p>
            <ul style={{ margin: 0, padding: "0 0 0 1.1rem", fontSize: "0.82rem", lineHeight: 1.6, color: "var(--color-text-muted)" }}>
              <li>Drag & drop or click to upload</li>
              <li>JPG, PNG, GIF, WebP images</li>
              <li>MP4 / WebM videos</li>
              <li>Max 50 MB per file</li>
              <li>Stored in Supabase Storage</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
