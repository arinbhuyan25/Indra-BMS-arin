import DQDVChart from "./DQDVChart";
import AnalyticsPage from "./AnalyticsPage";
import ProjectionPage from "./ProjectionPage";
import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart
} from "recharts";
import { useSerial } from "./useSerial";
import NASADataExplorer from "./NASADataExplorer";
import InfoButton from "./InfoButton";
import nasaData from "./nasa_mock_data.json";
import "./App.css";

// --- DATA SIMULATION ---
function generateDQDV(cycle = 0, plating = false) {
  const points = [];
  for (let v = 3.0; v <= 4.2; v += 0.01) {
    let dqdv = 0;
    dqdv += 18 * Math.exp(-Math.pow((v - 3.45) / 0.06, 2));
    dqdv += 12 * Math.exp(-Math.pow((v - 3.72) / 0.05, 2));
    dqdv += 6 * Math.exp(-Math.pow((v - 4.05) / 0.04, 2));
    const aging = 1 - cycle * 0.0008;
    dqdv *= aging;
    if (plating && v > 3.38 && v < 3.52) dqdv += 3.5 * Math.exp(-Math.pow((v - 3.44) / 0.03, 2));
    dqdv += (Math.random() - 0.5) * 0.3;
    points.push({ v: parseFloat(v.toFixed(2)), dqdv: parseFloat(Math.max(0, dqdv).toFixed(3)) });
  }
  return points;
}

function generateCells(baseTemp = 28) {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `C${String(i + 1).padStart(2, "0")}`,
    // Digital Twin: Real Sensor + Gaussian Jitter
    temp: baseTemp + (Math.random() - 0.5) * 1.5,
  }));
}

function getCellColor(temp) {
  if (temp < 32) return `rgba(0, 180, 255, ${0.45 + (temp - 28) / 12})`;
  if (temp < 38) return `rgba(0, 230, 120, ${0.5 + (temp - 32) / 10})`;
  if (temp < 42) return `rgba(255, 190, 0, ${0.55 + (temp - 38) / 8})`;
  return `rgba(255, 30, 70, ${0.65 + Math.min((temp - 42) / 8, 0.35)})`;
}

function generateCycleHistory() {
  return Array.from({ length: 30 }, (_, i) => ({
    cycle: i + 1,
    soh: 100 - i * 0.4 - Math.random() * 0.5,
    color: i < 20 ? "var(--accent-green)" : i < 26 ? "var(--accent-yellow)" : "var(--accent-orange)",
  }));
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-bright)",
        borderRadius: 8, padding: "8px 12px", fontSize: 11,
      }}>
        <div style={{ color: "var(--text-secondary)" }}>V: <span style={{ color: "var(--accent-cyan)" }}>{payload[0]?.payload?.v} V</span></div>
        <div style={{ color: "var(--text-secondary)" }}>dQ/dV: <span style={{ color: "var(--accent-green)" }}>{payload[0]?.value}</span></div>
      </div>
    );
  }
  return null;
};
// ─── Thermal Monitor ────────────────────────────────────────
const MIN_TEMP = 10;
const MAX_TEMP = 55;
const HISTORY_LIMIT = 20;

function getTempStatus(t) {
  if (t >= 45) return { label: "HOT", color: "var(--accent-red)", bg: "rgba(255,45,85,0.1)", border: "rgba(255,45,85,0.35)" };
  if (t >= 35) return { label: "WARN", color: "var(--accent-yellow)", bg: "rgba(255,214,10,0.08)", border: "rgba(255,214,10,0.3)" };
  return { label: "PASS", color: "var(--accent-green)", bg: "rgba(0,255,136,0.06)", border: "rgba(0,255,136,0.25)" };
}

function ThermalMonitor({ cells }) {
  const temp = cells[0]?.temp ?? 27;
  const pct = Math.min(Math.max(((temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)) * 100, 0), 100);
  const status = getTempStatus(temp);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);

  // Append to history whenever temp changes
  useEffect(() => {
    setHistory(prev => {
      const entry = {
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        temp,
        ...getTempStatus(temp),
      };
      const next = [entry, ...prev];
      return next.slice(0, HISTORY_LIMIT);
    });
  }, [Math.round(temp * 10)]); // update when 10th-degree digit changes

  const zones = [
    { label: "COOL", range: "10–34°", color: "#00cfff" },
    { label: "NORMAL", range: "35–44°", color: "#ffd60a" },
    { label: "HOT", range: "45–55°", color: "#ff2d55" },
  ];

  return (
    <div className="card span-3">
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div className="card-title yellow" style={{ marginBottom: 0 }}>Cell Temperature Monitor — DS18B20</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 900,
            color: status.color, textShadow: `0 0 16px ${status.color}55`, lineHeight: 1,
          }}>
            {temp.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 3, color: "var(--text-secondary)" }}>°C</span>
          </div>
          <div style={{
            fontSize: 10, fontFamily: "'Orbitron', monospace", letterSpacing: 1.5,
            padding: "4px 12px", borderRadius: 20,
            color: status.color, background: status.bg, border: `1px solid ${status.border}`,
          }}>{status.label}</div>
        </div>
      </div>

      {/* Thermometer bar */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        {/* Track */}
        <div style={{
          height: 12, borderRadius: 6, position: "relative", overflow: "visible",
          background: "linear-gradient(90deg, #00cfff 0%, #00ff88 35%, #ffd60a 65%, #ff6b2b 82%, #ff2d55 100%)",
          boxShadow: "0 0 16px rgba(0,207,255,0.12)",
        }}>
          {/* Frosted overlay for unlit portion */}
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0,
            width: `${100 - pct}%`,
            background: "rgba(5,8,16,0.72)",
            borderRadius: "0 6px 6px 0",
            backdropFilter: "blur(2px)",
            transition: "width 1s ease",
          }} />
          {/* Live marker */}
          <div style={{
            position: "absolute", top: "50%", left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            width: 16, height: 16, borderRadius: "50%",
            background: status.color,
            border: "2px solid var(--bg-primary)",
            boxShadow: `0 0 12px ${status.color}, 0 0 4px ${status.color}`,
            transition: "left 1s ease",
            zIndex: 2,
          }} />
        </div>

        {/* Scale labels below track */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingLeft: 2, paddingRight: 2 }}>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, color: "var(--text-secondary)", letterSpacing: 1 }}>{MIN_TEMP}°C</span>
          {zones.map(z => (
            <span key={z.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 7, color: z.color, letterSpacing: 1.5 }}>{z.label}</span>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 8, color: "var(--text-secondary)" }}>{z.range}</span>
            </span>
          ))}
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, color: "var(--text-secondary)", letterSpacing: 1 }}>{MAX_TEMP}°C</span>
        </div>
      </div>

      {/* Sensor source badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, marginTop: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)", display: "inline-block", boxShadow: "0 0 6px var(--accent-green)", animation: "pulse 1.5s infinite" }} />
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: "var(--text-secondary)", letterSpacing: 0.5 }}>S1 — DS18B20 · GPIO4 · 1-Wire · 0.0625°C resolution</span>
      </div>

      {/* Collapsible history */}
      <div
        onClick={() => setHistoryOpen(o => !o)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", userSelect: "none",
          borderTop: "1px solid var(--border)", paddingTop: 12,
        }}
      >
        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, letterSpacing: 2, color: "var(--text-secondary)", textTransform: "uppercase" }}>
          Temperature History ({history.length} readings)
        </span>
        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, color: "var(--text-secondary)", letterSpacing: 1 }}>
          {historyOpen ? "▲ COLLAPSE" : "▼ EXPAND"}
        </span>
      </div>

      {historyOpen && (
        <div style={{ marginTop: 12, overflowY: "auto", maxHeight: 220 }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 80px",
            gap: "0 16px", paddingBottom: 8,
            borderBottom: "1px solid var(--border)", marginBottom: 4,
          }}>
            {["TIMESTAMP", "TEMP (°C)", "STATUS"].map(h => (
              <span key={h} style={{ fontFamily: "'Orbitron', monospace", fontSize: 7, letterSpacing: 2, color: "var(--text-secondary)", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
          {history.map((row, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 80px",
              gap: "0 16px",
              padding: "8px 0",
              borderBottom: "1px solid rgba(26,42,74,0.5)",
              alignItems: "center",
              opacity: i === 0 ? 1 : 0.72 - i * 0.025,
              transition: "opacity 0.3s",
            }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: "var(--text-secondary)" }}>{row.ts}</span>
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 12, fontWeight: 700, color: row.color }}>{row.temp.toFixed(2)}</span>
              <span style={{
                fontFamily: "'Orbitron', monospace", fontSize: 8, letterSpacing: 1.5,
                padding: "3px 8px", borderRadius: 12, textAlign: "center",
                color: row.color, background: row.bg, border: `1px solid ${row.border}`,
                display: "inline-block",
              }}>{row.label}</span>
            </div>
          ))}
          {history.length === 0 && (
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: "var(--text-secondary)", padding: "12px 0", textAlign: "center" }}>
              No readings yet — connect board or wait for simulation.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const [dqdvData, setDqdvData] = useState(() => generateDQDV(0, false));
  const [cells, setCells] = useState(generateCells);
  const [cycleHistory] = useState(generateCycleHistory);
  const [soh, setSoh] = useState(87.4);
  const [cycle, setCycle] = useState(312);
  const [voltage, setVoltage] = useState(3.71);
  const [current, setCurrent] = useState(1.82);
  const [coulombAuth, setCoulombAuth] = useState(0);
  const [livePeak, setLivePeak] = useState(3.45);
  const [platingDetected, setPlatingDetected] = useState(true);
  const [bytesSent, setBytesSent] = useState(2048);
  const [time, setTime] = useState(new Date());
  const tickRef = useRef(0);
  const [page, setPage] = useState("overview");

  // --- Web Serial bridge ---
  const { connected, error: serialError, telemetry, connect, disconnect } = useSerial();

  // When real telemetry arrives, override simulation state
  useEffect(() => {
    if (!connected) return;
    if (telemetry.busV !== null) setVoltage(parseFloat(telemetry.busV.toFixed(2)));
    if (telemetry.current !== null) setCurrent(parseFloat((telemetry.current / 1000).toFixed(2)));
    if (telemetry.cellTemp !== null) {
      const t = telemetry.cellTemp;
      setCells(generateCells(t));
    }
    if (telemetry.cycle !== null && telemetry.cycle !== undefined) {
      setCycle(telemetry.cycle);
    }
    if (telemetry.soc !== null && telemetry.soc !== undefined) {
      // Temporarily use the SOH dial to show hardware-estimated SOC if we want, or at least keep it updating
      setSoh(parseFloat(telemetry.soc.toFixed(1)));
    }
    if (telemetry.mAh !== null && telemetry.mAh !== undefined) {
      setCoulombAuth(telemetry.mAh);
    }
    if (telemetry.peakV !== null && telemetry.peakV !== undefined) {
      if (telemetry.peakV > 3.0) setLivePeak(telemetry.peakV);
    }
    // A typical Indra-BMS v0.5 JSON string is exactly 126 bytes
    setBytesSent(b => b + 126);
  }, [telemetry, connected]);

  // --- Simulation loop (runs always; serial values win via override above) ---
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;

      setTime(new Date());

      // Voltage: gentle random walk, clamped to realistic cell range
      if (!connected || telemetry.busV === null) {
        setVoltage(v => parseFloat(Math.min(4.20, Math.max(3.00, v + (Math.random() - 0.5) * 0.02)).toFixed(2)));
      }
      // Current: gentle random walk, clamped to 0.5–2.5 A (always positive — sim is discharge)
      if (!connected || telemetry.current === null) {
        setCurrent(c => parseFloat(Math.min(2.5, Math.max(0.5, c + (Math.random() - 0.5) * 0.05)).toFixed(2)));
      }
      // Temp: slow sine drift, updates every 6 ticks
      if (t % 6 === 0 && (!connected || telemetry.cellTemp === null)) {
        const simTemp = 26.5 + Math.sin(t / 20) * 2;
        setCells(generateCells(simTemp));
      }
      // SOH: very slow decay matching real aging rate (~0.01% per tick = ~1% per 100 cycles)
      // DQ/dV: refresh every 10 ticks
      if (t % 10 === 0) {
        setDqdvData(generateDQDV(cycle, platingDetected));
        setSoh(s => parseFloat(Math.max(70, s - 0.01 + Math.random() * 0.005).toFixed(2)));
      }

      if (!connected) setBytesSent(b => b + 50);
    }, 1000);
    return () => clearInterval(interval);
  }, [cycle, platingDetected, connected, telemetry]);

  const rawEquivalent = bytesSent * 200;
  const saving = (((rawEquivalent - bytesSent) / rawEquivalent) * 100).toFixed(1);

  const baseAlerts = [
    platingDetected
      ? { type: "critical", msg: "Lithium Plating detected — Peak shift @ 3.44V" }
      : null,
    soh < 88
      ? { type: "warning", msg: "Loss of Active Material — SEI layer growth" }
      : null,
    { type: "warning", msg: "Loss of Lithium Inventory — Li⁺ trapped in SEI layer" },
    { type: "nominal", msg: "Electrolyte decomposition — within threshold" },
  ].filter(Boolean);

  const alerts = connected && telemetry.health
    ? [{ type: telemetry.health === "OK" ? "nominal" : "critical", msg: `Hardware Status: ${telemetry.health}` }, ...baseAlerts]
    : baseAlerts;

  const sohColor = soh > 90 ? "var(--accent-green)" : soh > 80 ? "var(--accent-yellow)" : "var(--accent-orange)";
  const circumference = 2 * Math.PI * 68;
  const dashOffset = circumference * (1 - soh / 100);

  return (
    <div className="dashboard">
      {/* HEADER */}
      <div className="header">
        <div className="header-left">
          <div className="logo">INDRA-BMS</div>
          <div className="tagline">Edge-Native · Physics-Informed · White-Box Analytics</div>
        </div>
        <div className="header-right">
          {serialError && (
            <div style={{ fontSize: 10, color: "var(--accent-red)", maxWidth: 220, textAlign: "right", lineHeight: 1.4 }}>
              {serialError}
            </div>
          )}
          <button
            id="serial-connect-btn"
            onClick={connected ? disconnect : connect}
            style={{
              background: connected ? "rgba(0,255,136,0.12)" : "rgba(0,207,255,0.08)",
              border: `1px solid ${connected ? "rgba(0,255,136,0.5)" : "rgba(0,207,255,0.3)"}`,
              borderRadius: 8,
              color: connected ? "var(--accent-green)" : "var(--accent-cyan)",
              cursor: "pointer",
              fontFamily: "'Orbitron', monospace",
              fontSize: 9,
              letterSpacing: 1.5,
              padding: "7px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.3s",
              boxShadow: connected ? "0 0 12px rgba(0,255,136,0.15)" : "none",
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: connected ? "var(--accent-green)" : "var(--accent-cyan)",
              boxShadow: connected ? "0 0 6px var(--accent-green)" : "0 0 6px var(--accent-cyan)",
              animation: connected ? "pulse 1.5s infinite" : "none",
              display: "inline-block",
            }} />
            {connected ? "BOARD CONNECTED" : "CONNECT BOARD"}
          </button>
          <div className="live-indicator">
            <div className="live-dot" />
            {connected ? "HW — VSDSquadron ULTRA" : "SIM — VSDSquadron ULTRA"}
          </div>
          <div className="timestamp">{time.toLocaleTimeString()}</div>
        </div>
      </div>

      {/* NAVIGATION BAR */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        background: "var(--bg-card)", borderRadius: 10,
        padding: 4, border: "1px solid var(--border)",
        position: "relative", zIndex: 1,
      }}>
        {[
          { id: "overview", label: "OVERVIEW", icon: "◎" },
          { id: "analytics", label: "DEEP-DIVE ANALYTICS", icon: "◈" },
          { id: "projection", label: "DIGITAL TWIN", icon: "◇" },
          { id: "nasa", label: "NASA DATA EXPLORER", icon: "⎈" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPage(tab.id)}
            style={{
              flex: 1,
              background: page === tab.id
                ? "linear-gradient(135deg, rgba(0,207,255,0.12), rgba(0,255,136,0.08))"
                : "transparent",
              border: page === tab.id
                ? "1px solid rgba(0,207,255,0.3)"
                : "1px solid transparent",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              fontFamily: "'Orbitron', monospace",
              fontSize: 8,
              letterSpacing: 2,
              color: page === tab.id ? "var(--accent-cyan)" : "var(--text-secondary)",
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              textTransform: "uppercase",
              boxShadow: page === tab.id ? "0 0 12px rgba(0,207,255,0.08)" : "none",
            }}
          >
            <span style={{ fontSize: 12 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* PAGE CONTENT */}
      {page === "analytics" && (
        <AnalyticsPage soh={soh} bytesSent={bytesSent} />
      )}

      {page === "projection" && (
        <ProjectionPage soh={soh} cycle={cycle} voltage={voltage} current={current} connected={connected} />
      )}

      {page === "nasa" && (
        <NASADataExplorer />
      )}

      {page === "overview" && (
        <>
          {/* METRIC CARDS ROW */}
          <div className="metric-row">
            <div className="metric-card" style={{ opacity: connected ? 0.4 : 1, filter: connected ? "grayscale(100%)" : "none" }}>
              <div className="metric-top">
                <span className="metric-label">STATE OF HEALTH <InfoButton infoKey="soh" /></span>
                <span className="metric-icon" style={{ color: "var(--accent-green)" }}>♥</span>
              </div>
              <div className="metric-bottom">
                <span className="metric-value" style={{ color: sohColor }}>{connected ? "--" : soh.toFixed(1)}%</span>
                {!connected && <span className="metric-trend negative">▼ 0.1%</span>}
              </div>
              <div className="metric-bar-track">
                <div className="metric-bar-fill" style={{ width: `${soh}%`, background: sohColor }} />
              </div>
              {connected && <div style={{ fontSize: 9, color: "var(--accent-yellow)", marginTop: 6 }}>Awaiting Edge ML Sync</div>}
            </div>

            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">PACK VOLTAGE <InfoButton infoKey="packVoltage" /></span>
                <span className="metric-icon" style={{ color: "var(--accent-cyan)" }}>⚡</span>
              </div>
              <div className="metric-bottom">
                <span className="metric-value cyan">{voltage} <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>V</span></span>
              </div>
              <div className="metric-sub">Live — updating 1Hz</div>
            </div>

            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">INTEGRATED CAPACITY <InfoButton infoKey="testMode" /></span>
                <span className="metric-icon" style={{ color: "var(--accent-yellow)" }}>⚙</span>
              </div>
              <div className="metric-bottom">
                <span className="metric-value">{connected ? Math.abs(coulombAuth).toFixed(1) : "328.4"} <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>mAh</span></span>
              </div>
              <div className="metric-sub">
                <span className="live-dot" style={{ width: 6, height: 6, display: "inline-block", marginRight: 6, borderRadius: "50%", background: connected ? "var(--accent-green)" : "var(--accent-yellow)", animation: "pulse 1.5s infinite" }} />
                {connected ? "Coulomb Count (Edge)" : "Const_Current Sim"}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">LIVE dQ/dV PEAK <InfoButton infoKey="peakPosError" /></span>
                <span className="metric-icon" style={{ color: "var(--text-secondary)" }}>⊕</span>
              </div>
              <div className="metric-bottom">
                <span className="metric-value cyan">{connected ? livePeak.toFixed(3) : "3.440"} <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>V</span></span>
              </div>
              <div className="metric-sub" style={{ color: connected && livePeak < 3.42 ? "var(--accent-orange)" : "var(--accent-green)" }}>
                {connected && livePeak < 3.42 ? "Peak Shift Warning!" : "Within Tolerance"}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-top">
                <span className="metric-label">THERMAL NORM <InfoButton infoKey="thermalNorm" /></span>
                <span className="metric-icon" style={{ color: "var(--accent-red)" }}>🌡</span>
              </div>
              <div className="metric-bottom">
                <span className="metric-value" style={{ fontSize: 16 }}>Arrhenius</span>
              </div>
              <div className="metric-sub">Corrected to 25°C</div>
            </div>
          </div>
          <div className="grid-main">
            {/* 1. dQ/dV GRAPH — spans 2 cols */}
            <div className="card span-2" style={{ minHeight: 380 }}>
              <DQDVChart telemetry={{ P1_V: 2.9, P2_V: 3.8, Mode: platingDetected ? "LLI" : "nominal", cycle }} />
            </div>

            {/* 2. RUL CARD */}
            <div className="card" style={{ opacity: connected ? 0.4 : 1, filter: connected ? "grayscale(100%)" : "none", pointerEvents: connected ? "none" : "auto" }}>
              <div className="card-title green" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Remaining Useful Life <InfoButton infoKey="rul" /></div>
              <div className="soh-container">
                <div className="gauge-wrapper">
                  <svg className="gauge-svg" width="160" height="160" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="68" fill="none" stroke="var(--bg-secondary)" strokeWidth="10" />
                    <circle cx="80" cy="80" r="68" fill="none" stroke="var(--accent-cyan)"
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - (soh - 70) / 30)}
                      style={{ filter: "drop-shadow(0 0 8px var(--accent-cyan))", transition: "stroke-dashoffset 1s ease" }} />
                  </svg>
                  <div className="gauge-value">
                    <div className="gauge-number" style={{ color: "var(--accent-cyan)", fontSize: 26 }}>{connected ? "--" : Math.round(Math.max(0, (soh - 70) * 56))}</div>
                    <div className="gauge-unit">cycles left</div>
                  </div>
                </div>
                <div className="soh-label">ESTIMATED RUL</div>
                <div className="soh-status good">{connected ? "Model Offline" : "CELL: BATT-883-X"}</div>
              </div>
            </div>

            {/* 3. LIVE STATS */}
            <div className="card">
              <div className="card-title cyan" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Live Telemetry <InfoButton infoKey="liveTelemetry" /></div>
              <div className="stats-row">
                <div className="stat-item">
                  <span className="stat-label">PACK VOLTAGE</span>
                  <span className="stat-value cyan">{voltage} V</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">CURRENT</span>
                  <span className="stat-value green">{current} A</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">CHARGE CYCLES</span>
                  <span className="stat-value orange">{cycle}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">AVG CELL TEMP</span>
                  <span className="stat-value yellow">
                    {cells[0]?.temp.toFixed(1)} °C
                    <span style={{ fontSize: 9, color: "var(--text-secondary)", marginLeft: 6 }}>(S1-DS18B20)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 4. BANDWIDTH SAVINGS */}
            <div className="card">
              <div className="card-title green" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Edge-Native Bandwidth <InfoButton infoKey="bandwidthSavings" /></div>
              <div className="bandwidth-display">
                <div className="bw-row">
                  <span className="bw-label">RAW (cloud)</span>
                  <span className="bw-value bad">{(rawEquivalent / 1024).toFixed(1)} KB</span>
                </div>
                <div className="bw-row">
                  <span className="bw-label">INDRA-BMS (edge)</span>
                  <span className="bw-value good">{bytesSent} B</span>
                </div>
                <div className="bw-bar-track">
                  <div className="bw-bar-fill" style={{ width: `${saving}%` }} />
                </div>
                <div className="bw-saving">{saving}%</div>
                <div className="bw-saving-label">DATA REDUCTION ACHIEVED</div>
              </div>
            </div>

            {/* 5. DEGRADATION ALERTS */}
            <div className="card">
              <div className="card-title red" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Degradation Classifier <InfoButton infoKey="degradationClassifier" /></div>
              <div className="alert-list">
                {alerts.map((a, i) => (
                  <div key={i} className={`alert-item ${a.type}`}>
                    <div className="alert-dot" />
                    {a.msg}
                  </div>
                ))}
              </div>
            </div>

            {/* 6. THERMAL MONITOR — bar scale + history table */}
            <ThermalMonitor cells={cells} />

            {/* 7. CYCLE HISTORY — spans 3 cols */}
            <div className="card span-3">
              <div className="card-title cyan" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Charge Cycle History — SoH Trend <InfoButton infoKey="cycleHistory" /></div>
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cycleHistory} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
                    <defs>
                      <linearGradient id="cycleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00cfff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00cfff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="cycle"
                      stroke="#4a6a8a"
                      tickLine={{ stroke: "#2a4a7a" }}
                      tick={{ fontSize: 10, fill: "#a8c4df", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      label={{
                        value: "CHARGE CYCLE",
                        position: "insideBottom",
                        offset: -18,
                        fill: "#7a9bbf",
                        fontSize: 8,
                        fontFamily: "'Orbitron', monospace",
                        letterSpacing: 2,
                      }}
                    />
                    <YAxis
                      stroke="#4a6a8a"
                      tickLine={{ stroke: "#2a4a7a" }}
                      tick={{ fontSize: 10, fill: "#a8c4df", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      domain={['dataMin - 1', 'dataMax + 0.5']}
                      tickFormatter={v => `${v.toFixed(0)}%`}
                      width={42}
                      label={{
                        value: "SOH %",
                        angle: -90,
                        position: "insideLeft",
                        offset: 6,
                        fill: "#7a9bbf",
                        fontSize: 8,
                        fontFamily: "'Orbitron', monospace",
                        letterSpacing: 2,
                        style: { textAnchor: "middle" },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-bright)",
                        borderRadius: 8,
                        fontSize: 11,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                      formatter={(val) => [`${val.toFixed(2)}%`, "SoH"]}
                      labelFormatter={(cycle) => `Cycle ${cycle}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="soh"
                      stroke="var(--accent-cyan)"
                      strokeWidth={2}
                      fill="url(#cycleGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>


          </div>
        </> /* end overview */
      )}
    </div>
  );
}