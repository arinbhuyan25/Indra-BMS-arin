import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

// --- Savitzky-Golay ---
function savitzkyGolay(data, key) {
  const coeffs = [-3, 12, 17, 12, -3];
  const norm = 35;
  const result = [...data];
  for (let i = 2; i < data.length - 2; i++) {
    let val = 0;
    for (let j = 0; j < 5; j++) val += coeffs[j] * data[i - 2 + j][key];
    result[i] = { ...data[i], [key]: Math.max(0, val / norm) };
  }
  return result;
}

// --- Generate curve ---
function generateCurve({ cycleCount = 0, mode = "nominal", p1V = 2.9, p2V = 3.8 }) {
  const points = [];
  const lliShift = mode === "LLI" ? 0.06 : 0;
  const lamScale = mode === "LAM" ? 0.65 : 1.0;

  for (let v = 2.5; v <= 4.25; v += 0.01) {
    const aging = 1 - cycleCount * 0.0006;
    let dqdv = 22 * Math.exp(-Math.pow((v - (p1V + lliShift)) / 0.09, 2)) * aging * lamScale;
    dqdv += 14 * Math.exp(-Math.pow((v - (p2V + lliShift * 0.5)) / 0.07, 2)) * aging * lamScale;
    dqdv += 6  * Math.exp(-Math.pow((v - (3.2 + lliShift * 0.3)) / 0.06, 2)) * aging;
    if (mode === "LLI") dqdv += 4 * Math.exp(-Math.pow((v - (p1V - 0.05)) / 0.03, 2));
    dqdv += (Math.random() - 0.5) * 2.8;
    points.push({ v: parseFloat(v.toFixed(2)), dqdv: parseFloat(Math.max(0, dqdv).toFixed(3)) });
  }
  return points;
}

function generateBaseline(p1V = 2.9, p2V = 3.8) {
  const pts = generateCurve({ cycleCount: 0, mode: "nominal", p1V, p2V });
  return savitzkyGolay(pts, "dqdv");
}

function findPeaks(data) {
  const peaks = [];
  for (let i = 2; i < data.length - 2; i++) {
    const { v, dqdv } = data[i];
    if (dqdv > data[i-1].dqdv && dqdv > data[i-2].dqdv &&
        dqdv > data[i+1].dqdv && dqdv > data[i+2].dqdv && dqdv > 4) {
      peaks.push({ v, dqdv, index: i });
    }
  }
  return peaks.sort((a, b) => b.dqdv - a.dqdv).slice(0, 2).sort((a, b) => a.v - b.v);
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10,15,30,0.95)", border: "1px solid rgba(0,207,255,0.3)",
      borderRadius: 8, padding: "8px 14px", fontSize: 11,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      boxShadow: "0 0 20px rgba(0,207,255,0.15)"
    }}>
      <div style={{ color: "#7a9bbf" }}>V: <span style={{ color: "#00cfff", fontWeight: 600 }}>{payload[0]?.payload?.v} V</span></div>
      <div style={{ color: "#7a9bbf" }}>dQ/dV: <span style={{ color: "#00ff88", fontWeight: 600 }}>{payload[0]?.value?.toFixed(3)}</span></div>
    </div>
  );
};

// --- Peak Overlay (rendered outside Recharts) ---
function PeakOverlay({ peaks, chartDimensions, dataRange, hoveredPeak, setHoveredPeak, baselineP1V }) {
  if (!chartDimensions || !dataRange) return null;
  const { left, top, width, height } = chartDimensions;

  const toPixel = (v, dqdv) => {
    const x = left + ((v - dataRange.minV) / (dataRange.maxV - dataRange.minV)) * width;
    const y = top + height - ((dqdv - dataRange.minD) / (dataRange.maxD - dataRange.minD)) * height;
    return { x, y };
  };

  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
      {peaks.map((peak, i) => {
        const { x, y } = toPixel(peak.v, peak.dqdv);
        const isHovered = hoveredPeak?.v === peak.v;
        const isP1 = peak.v < 3.3;
        const shift = isP1 ? ((peak.v - baselineP1V) * 1000).toFixed(0) : null;

        return (
          <g key={i}>
            {/* Glow rings */}
            <circle cx={x} cy={y} r={isHovered ? 14 : 10}
              fill={isHovered ? "rgba(0,207,255,0.12)" : "rgba(0,207,255,0.04)"}
              stroke={isHovered ? "rgba(0,207,255,0.5)" : "rgba(0,207,255,0.15)"}
              strokeWidth={1}
              style={{ transition: "all 0.25s" }} />
            <circle cx={x} cy={y} r={isHovered ? 7 : 5}
              fill="rgba(0,207,255,0.2)"
              stroke="rgba(0,207,255,0.7)"
              strokeWidth={1}
              style={{ transition: "all 0.25s" }} />
            {/* Core dot */}
            <circle cx={x} cy={y} r={3.5} fill="#00cfff"
              stroke="#ffffff" strokeWidth={1.5}
              style={{ filter: "drop-shadow(0 0 6px #00cfff)" }} />
            {/* Invisible hover target — has pointer events */}
            <circle cx={x} cy={y} r={18} fill="transparent"
              style={{ pointerEvents: "all", cursor: "crosshair" }}
              onMouseEnter={() => setHoveredPeak(peak)}
              onMouseLeave={() => setHoveredPeak(null)} />
            {/* Tooltip box */}
            {isHovered && (
              <foreignObject
                x={x - 58}
                y={Math.max(4, y - 80)}
                width={116}
                height={65}
                style={{ pointerEvents: "none", overflow: "visible" }}>
                <div style={{
                  background: "rgba(5,8,16,0.97)",
                  border: "1px solid rgba(0,207,255,0.55)",
                  borderRadius: 8, padding: "6px 10px",
                  fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif",
                  textAlign: "center",
                  boxShadow: "0 0 20px rgba(0,207,255,0.3)",
                }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{peak.v.toFixed(2)}V Peak</div>
                  <div style={{ color: "#7a9bbf", fontSize: 9, marginTop: 2 }}>{peak.dqdv.toFixed(2)} Ah/V</div>
                  {shift !== null && (
                    <div style={{ color: Math.abs(shift) > 5 ? "#ff2d55" : "#00ff88", fontSize: 9, marginTop: 2 }}>
                      Shift: {shift > 0 ? "+" : ""}{shift}mV
                    </div>
                  )}
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// --- MAIN COMPONENT ---
export default function DQDVChart({ telemetry }) {
  const p1V   = telemetry?.P1_V  ?? 2.9;
  const p2V   = telemetry?.P2_V  ?? 3.8;
  const mode  = telemetry?.Mode  ?? "nominal";
  const cycle = telemetry?.cycle ?? 312;

  const [showBaseline, setShowBaseline] = useState(true);
  const [showSG, setShowSG]             = useState(false);
  const [rawData, setRawData]           = useState(() => generateCurve({ cycleCount: cycle, mode, p1V, p2V }));
  const [smoothData, setSmoothData]     = useState(() => savitzkyGolay(generateCurve({ cycleCount: cycle, mode, p1V, p2V }), "dqdv"));
  const [baseline]                      = useState(() => generateBaseline(p1V, p2V));
  const [hoveredPeak, setHoveredPeak]   = useState(null);
  const [chartDims, setChartDims]       = useState(null);
  const containerRef                    = useRef(null);
  const tickRef                         = useRef(0);

  // Update curve every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      if (tickRef.current % 10 === 0) {
        const raw = generateCurve({ cycleCount: cycle, mode, p1V, p2V });
        setRawData(raw);
        setSmoothData(savitzkyGolay([...raw], "dqdv"));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cycle, mode, p1V, p2V]);

  // Measure chart plot area
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const svg = containerRef.current.querySelector(".recharts-plot-surface, .recharts-cartesian-grid");
      const wrapper = containerRef.current.querySelector(".recharts-wrapper");
      if (!wrapper) return;
      const wRect = wrapper.getBoundingClientRect();
      const cRect = containerRef.current.getBoundingClientRect();
      // Recharts default margins: top:10, right:10, left:~30, bottom:~30
      setChartDims({
        left:   30,
        top:    10,
        width:  wRect.width  - 40,
        height: wRect.height - 50,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const activeData = showSG ? smoothData : rawData;
  const peaks      = findPeaks(activeData);
  const allDqdv    = activeData.map(d => d.dqdv);
  const dataRange  = {
    minV: 2.5, maxV: 4.25,
    minD: 0,   maxD: Math.max(...allDqdv) * 1.1
  };

  const mergedData = activeData.map((pt, i) => ({
    ...pt,
    rawDqdv: rawData[i]?.dqdv ?? 0,
    baseline: baseline[i]?.dqdv ?? 0,
  }));

  const showRawOverlap = showSG; // Show raw noise behind the smooth curve

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 9, letterSpacing: 2.5, color: "#7a9bbf", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 3, height: 12, borderRadius: 2, background: "#00cfff", display: "inline-block" }} />
            dQ/dV Analysis — Differential Capacity Curve
          </div>
          <div style={{ fontSize: 10, color: "#4a6a8a", marginTop: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Cycle {cycle} • Cell BATT-883-X •&nbsp;
            <span style={{ color: mode === "LLI" ? "#ff2d55" : mode === "LAM" ? "#ffd60a" : "#00ff88" }}>
              Mode: {mode.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "BASELINE", state: showBaseline, set: setShowBaseline, color: "#00cfff" },
            { label: "S-G FILTER", state: showSG, set: setShowSG, color: "#00ff88" },
          ].map(({ label, state, set, color }) => (
            <div key={label} onClick={() => set(s => !s)} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-secondary)",
              border: `1px solid ${state ? color + "55" : "var(--border)"}`,
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              boxShadow: state ? `0 0 12px ${color}22` : "none",
              transition: "all 0.3s"
            }}>
              <div style={{
                width: 28, height: 15, borderRadius: 8,
                background: state ? color : "#2a3a5a",
                position: "relative", transition: "background 0.2s"
              }}>
                <div style={{
                  position: "absolute", top: 2, left: state ? 14 : 2,
                  width: 11, height: 11, borderRadius: "50%",
                  background: "white", transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
                }} />
              </div>
              <span style={{ fontSize: 10, color: state ? color : "#7a9bbf", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: 1 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + overlay wrapper */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 220, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mergedData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
            <defs>
              <linearGradient id="dqdvFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#00cfff" stopOpacity={0.35} />
                <stop offset="60%"  stopColor="#00cfff" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#00cfff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rawFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#ff2d55" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#ff2d55" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="v"
              stroke="rgba(122,155,191,0.4)" tickLine={false} interval={9}
              tick={{ fontSize: 9, fill: "#7a9bbf", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              label={{ value: "VOLTAGE (V)", position: "insideBottom", offset: -12, fill: "#4a6a8a", fontSize: 9, letterSpacing: 2 }} />
            <YAxis
              stroke="rgba(122,155,191,0.4)" tickLine={false}
              tick={{ fontSize: 9, fill: "#7a9bbf", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              label={{ value: "dQ/dV (Ah/V)", angle: -90, position: "insideLeft", offset: 14, fill: "#4a6a8a", fontSize: 9 }} />
            <Tooltip content={<CustomTooltip />} />
            {showBaseline && (
              <Area type="monotone" dataKey="baseline"
                stroke="rgba(100,140,180,0.3)" strokeWidth={1}
                strokeDasharray="5 4" fill="none"
                dot={false} activeDot={false} />
            )}
            {showRawOverlap && (
              <Area type="monotone" dataKey="rawDqdv"
                stroke="rgba(255, 45, 85, 0.4)" strokeWidth={1}
                fill="url(#rawFill)" dot={false} activeDot={false} />
            )}
            <Area type="monotone" dataKey="dqdv"
              stroke={showSG ? "#00ff88" : "#00cfff"} strokeWidth={2.5}
              fill="url(#dqdvFill)" dot={false}
              activeDot={{ r: 4, fill: showSG ? "#00ff88" : "#00cfff", stroke: "#fff", strokeWidth: 1 }} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Peak overlay sits on top */}
        <PeakOverlay
          peaks={peaks}
          chartDimensions={chartDims}
          dataRange={dataRange}
          hoveredPeak={hoveredPeak}
          setHoveredPeak={setHoveredPeak}
          baselineP1V={p1V}
        />
      </div>

      {/* Peak info strip */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {peaks.map((p, i) => (
          <div key={i} style={{
            flex: 1, background: "var(--bg-secondary)",
            border: hoveredPeak?.v === p.v ? "1px solid rgba(0,207,255,0.4)" : "1px solid var(--border)",
            borderRadius: 8, padding: "6px 12px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            transition: "border-color 0.2s"
          }}>
            <span style={{ fontSize: 9, color: "#4a6a8a", fontFamily: "'Orbitron', monospace", letterSpacing: 1 }}>PEAK {i + 1}</span>
            <span style={{ fontSize: 12, color: "#00cfff", fontFamily: "'Orbitron', monospace", fontWeight: 700 }}>{p.v.toFixed(2)} V</span>
            <span style={{ fontSize: 9, color: p.dqdv > 10 ? "#00ff88" : "#ffd60a" }}>{p.dqdv.toFixed(2)} Ah/V</span>
          </div>
        ))}
        <div style={{
          background: "var(--bg-secondary)",
          border: `1px solid ${showSG ? "rgba(0,255,136,0.3)" : "var(--border)"}`,
          borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center"
        }}>
          <span style={{ fontSize: 9, color: showSG ? "#00ff88" : "#4a6a8a", fontFamily: "'Orbitron', monospace", letterSpacing: 1 }}>
            {showSG ? "S-G SMOOTHED" : "RAW SIGNAL"}
          </span>
        </div>
      </div>
    </div>
  );
}