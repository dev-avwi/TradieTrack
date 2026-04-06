import { useState, useRef, useCallback } from "react";

import dashboard from "@assets/appstore_screenshots/01_dashboard.png";
import jobsList from "@assets/appstore_screenshots/02_jobs_list.png";
import schedule from "@assets/appstore_screenshots/04_schedule.png";
import jobMap from "@assets/appstore_screenshots/05_job_map.png";
import quotePreview from "@assets/appstore_screenshots/07_quote_preview.png";

const SLIDES = [
  {
    headline: "The all-in-one\napp for tradies",
    subtext: "Manage jobs, teams & invoices\nfrom one powerful dashboard",
    screenshots: [dashboard, jobMap],
    layout: "duo-overlap" as const,
  },
  {
    headline: "Never Miss\nA Job",
    subtext: "Calendar built for tradies",
    screenshots: [schedule],
    layout: "single-center" as const,
  },
  {
    headline: "Professional\nQuotes, fast",
    subtext: "Send branded quotes in seconds",
    screenshots: [quotePreview],
    layout: "single-center" as const,
  },
  {
    headline: "All Jobs,\nOne Place",
    subtext: "From Pending to Invoiced",
    screenshots: [jobsList],
    layout: "single-center" as const,
  },
  {
    headline: "Track Your\nTeam Live",
    subtext: "See every job & trade\nin real-time on the map",
    screenshots: [jobMap, dashboard],
    layout: "duo-overlap" as const,
  },
];

const IPAD_PRESETS = {
  "12.9": { w: 2048, h: 2732, label: 'iPad Pro 12.9" (2048x2732)' },
  "11": { w: 1668, h: 2388, label: 'iPad Pro 11" (1668x2388)' },
};
type PresetKey = keyof typeof IPAD_PRESETS;

function PhoneFrame({
  src,
  style,
}: {
  src: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: 280,
        height: 570,
        borderRadius: 36,
        background: "#1a1a2e",
        padding: 8,
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.55), 0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 80,
          height: 22,
          borderRadius: 12,
          background: "#111",
          zIndex: 2,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 28,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}

function SlideCanvas({
  slide,
  canvasW,
  canvasH,
}: {
  slide: (typeof SLIDES)[0];
  canvasW: number;
  canvasH: number;
}) {
  const scale = canvasW / 2048;

  return (
    <div
      style={{
        width: canvasW,
        height: canvasH,
        background: "linear-gradient(165deg, #0d1b2a 0%, #1b2d45 35%, #162238 70%, #0d1b2a 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "60%",
          height: "60%",
          background: "radial-gradient(ellipse, rgba(74,144,217,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "-5%",
          width: "50%",
          height: "50%",
          background: "radial-gradient(ellipse, rgba(56,184,102,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: canvasH * 0.08,
        }}
      >
        <h2
          style={{
            color: "#ffffff",
            fontSize: 76 * scale,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.08,
            margin: 0,
            whiteSpace: "pre-line",
            letterSpacing: "-0.025em",
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
          }}
        >
          {slide.headline}
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 26 * scale,
            textAlign: "center",
            margin: `${18 * scale}px 0 0`,
            lineHeight: 1.45,
            whiteSpace: "pre-line",
            fontWeight: 400,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
            letterSpacing: "0.01em",
          }}
        >
          {slide.subtext}
        </p>

        <div
          style={{
            marginTop: canvasH * 0.05,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            position: "relative",
            height: canvasH * 0.62,
            width: "100%",
          }}
        >
          {slide.layout === "single-center" && (
            <PhoneFrame
              src={slide.screenshots[0]}
              style={{
                transform: `scale(${scale * 2.4})`,
                transformOrigin: "top center",
              }}
            />
          )}
          {slide.layout === "duo-overlap" && (
            <>
              <PhoneFrame
                src={slide.screenshots[0]}
                style={{
                  transform: `scale(${scale * 2.1}) rotate(-6deg)`,
                  transformOrigin: "top center",
                  position: "absolute",
                  left: `${canvasW * 0.15}px`,
                  top: 0,
                  zIndex: 2,
                }}
              />
              <PhoneFrame
                src={slide.screenshots[1]}
                style={{
                  transform: `scale(${scale * 2.1}) rotate(6deg)`,
                  transformOrigin: "top center",
                  position: "absolute",
                  right: `${canvasW * 0.15}px`,
                  top: `${canvasH * 0.03}px`,
                  zIndex: 1,
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IPadScreenshots() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [preset, setPreset] = useState<PresetKey>("12.9");
  const [busy, setBusy] = useState(false);
  const renderRef = useRef<HTMLDivElement>(null);

  const dim = IPAD_PRESETS[preset];
  const viewScale = Math.min(
    (window.innerWidth - 200) / dim.w,
    (window.innerHeight - 100) / dim.h,
    0.38,
  );

  const doExport = useCallback(async () => {
    if (!renderRef.current) return;
    setBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const el = renderRef.current;
      const canvas = await html2canvas(el, {
        scale: 1 / viewScale,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
      const a = document.createElement("a");
      a.download = `JobRunner_iPad_${preset}_slide${activeSlide + 1}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Try right-click > Save As on the preview, or use a browser screenshot extension.");
    } finally {
      setBusy(false);
    }
  }, [viewScale, preset, activeSlide]);

  const exportAll = useCallback(async () => {
    setBusy(true);
    try {
      for (let i = 0; i < SLIDES.length; i++) {
        setActiveSlide(i);
        await new Promise((r) => setTimeout(r, 500));
        if (!renderRef.current) continue;
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(renderRef.current, {
          scale: 1 / viewScale,
          useCORS: true,
          backgroundColor: null,
          logging: false,
          width: renderRef.current.offsetWidth,
          height: renderRef.current.offsetHeight,
        });
        const a = document.createElement("a");
        a.download = `JobRunner_iPad_${preset}_slide${i + 1}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }, [viewScale, preset]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080a",
        color: "#fff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: "1px solid #1a1a1a",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            JobRunner — iPad Screenshots
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: "#666", marginTop: 2 }}>
            App Store Connect ready &middot; {SLIDES.length} slides
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PresetKey)}
            style={{
              background: "#141418",
              color: "#ccc",
              border: "1px solid #2a2a2a",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              outline: "none",
            }}
          >
            {Object.entries(IPAD_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={doExport}
            disabled={busy}
            style={{
              background: "#4A90D9",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? "Exporting..." : "Download This Slide"}
          </button>
          <button
            onClick={exportAll}
            disabled={busy}
            style={{
              background: "#222",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            Download All
          </button>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 50px)" }}>
        <div
          style={{
            width: 130,
            borderRight: "1px solid #1a1a1a",
            padding: "10px 6px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              style={{
                width: "100%",
                aspectRatio: `${dim.w} / ${dim.h}`,
                borderRadius: 6,
                border: i === activeSlide ? "2px solid #4A90D9" : "1px solid #222",
                background: i === activeSlide ? "#1a2744" : "#111",
                cursor: "pointer",
                padding: 6,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  color: i === activeSlide ? "#fff" : "#888",
                  fontSize: 8,
                  fontWeight: 700,
                  textAlign: "center",
                  lineHeight: 1.15,
                  whiteSpace: "pre-line",
                }}
              >
                {s.headline}
              </span>
              <span style={{ color: "#555", fontSize: 7 }}>Slide {i + 1}</span>
            </button>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
            padding: 16,
            background: "#0a0a0c",
          }}
        >
          <div
            ref={renderRef}
            style={{
              width: dim.w * viewScale,
              height: dim.h * viewScale,
              borderRadius: 3,
              overflow: "hidden",
              flexShrink: 0,
              boxShadow: "0 4px 40px rgba(0,0,0,0.6)",
            }}
          >
            <SlideCanvas
              slide={SLIDES[activeSlide]}
              canvasW={dim.w * viewScale}
              canvasH={dim.h * viewScale}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
