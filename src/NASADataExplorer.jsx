import { useState } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Area, AreaChart,
    BarChart, Bar, ComposedChart, ReferenceLine
} from "recharts";
import nasaData from "./nasa_mock_data.json";
import healthData from "../ML/sample_health_vector.json";
import InfoButton from "./InfoButton";

// ─── CHART TITLE WITH INFO ──────────────────────────────────
function ChartTitle({ color, label, infoKey }) {
    return (
        <div className={`card-title ${color}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {label}
            <InfoButton infoKey={infoKey} />
        </div>
    );
}

// ─── METRIC CARD WITH INFO ──────────────────────────────────
function MetricCard({ label, value, unit, icon, color, infoKey, trend }) {
    return (
        <div className="metric-card" style={{ borderRadius: 4 }}>
            <div className="metric-top">
                <span className="metric-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {label}
                    <InfoButton infoKey={infoKey} />
                </span>
                <span className="metric-icon" style={{ color: `var(--accent-${color})` || "var(--text-secondary)" }}>{icon}</span>
            </div>
            <div className="metric-bottom">
                <span className={`metric-value ${color}`}>
                    {value}
                    {unit && <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 4 }}>{unit}</span>}
                </span>
                {trend && <span className="metric-trend negative" style={{ marginLeft: 8 }}>{trend}</span>}
            </div>
        </div>
    );
}

// ─── TOOLTIP STYLE ──────────────────────────────────────────
const ttStyle = { background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" };
const ttItem = (c) => ({ color: c, fontFamily: "'Orbitron', monospace", fontWeight: 700 });
const axTick = { fontSize: 10, fill: "#a8c4df", fontFamily: "'Plus Jakarta Sans', sans-serif" };
const axLabel = (v) => ({ value: v, position: "insideBottom", offset: -15, fill: "#7a9bbf", fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 2 });

// ─── BATTERY HEALTH TAB HELPERS ─────────────────────────────
const PALETTE = { B0005: "#00cfff", B0006: "#00ff88", B0007: "#ffd60a", B0018: "#ff6b2b" };

function getSohColor(s) {
    if (s >= 90) return "var(--accent-green)";
    if (s >= 80) return "var(--accent-cyan)";
    if (s >= 70) return "var(--accent-yellow)";
    return "var(--accent-red)";
}

function getStatusColor(s) {
    if (s === "Critical") return "var(--accent-red)";
    if (s === "Warning")  return "var(--accent-yellow)";
    return "var(--accent-green)";
}

const HealthTooltip = ({ active, payload, label, unit }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: 8, padding: "8px 14px", fontSize: 11, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ color: "var(--text-secondary)", marginBottom: 4, fontSize: 10 }}>Cycle {label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color, fontWeight: 600, fontFamily: "'Orbitron',monospace" }}>
                    {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value} {unit}
                </div>
            ))}
        </div>
    );
};

// ─── BATTERY HEALTH TAB COMPONENT ───────────────────────────
function BatteryHealthTab({ healthData }) {
    const batteries = Object.keys(healthData);

    const [graphBattery, setGraphBattery] = useState("ALL");
    const [activeMetric, setActiveMetric] = useState("soh_pct");
    const [cycleRange, setCycleRange]     = useState([0, 100]);

    const graphSelected = graphBattery === "ALL" ? batteries : [graphBattery];

    const metrics = [
        { key: "soh_pct",             label: "BATTERY HEALTH (SOH)", unit: "%",   color: "var(--accent-cyan)"   },
        { key: "charge_duration_min", label: "RECHARGE TIME",         unit: "min", color: "var(--accent-yellow)" },
        { key: "discharge_dur_min",   label: "BATTERY RUNTIME",       unit: "min", color: "var(--accent-green)"  },
    ];
    const currentMetric = metrics.find(m => m.key === activeMetric);

    function buildChartData() {
        const maxLen = Math.max(...graphSelected.map(b => healthData[b].cycles.length));
        const start  = Math.floor(cycleRange[0] / 100 * maxLen);
        const end    = Math.ceil(cycleRange[1]  / 100 * maxLen);
        const rows   = [];
        for (let i = start; i < end; i++) {
            const row = { cycle: healthData[graphSelected[0]]?.cycles[i] ?? i };
            graphSelected.forEach(bat => {
                const d = healthData[bat];
                if (i < d[activeMetric].length) {
                    row[bat]              = parseFloat(d[activeMetric][i].toFixed(2));
                    row[`${bat}_anomaly`] = d.anomalies.includes(d.cycles[i]);
                }
            });
            rows.push(row);
        }
        return rows;
    }

    const chartData    = buildChartData();
    const allAnomalies = graphSelected.flatMap(b => healthData[b].anomalies).length;
    const avgSoh       = (graphSelected.reduce((s, b) => s + healthData[b].current_soh, 0) / graphSelected.length).toFixed(1);
    const earliestEol  = graphSelected.map(b => healthData[b].eol_cycle).filter(Boolean).sort((a, b) => a - b)[0] ?? "N/A";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Stat cards ── */}
            {graphBattery === "ALL" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                    {(() => {
                        const worst      = batteries.reduce((a, b) => healthData[a].current_soh < healthData[b].current_soh ? a : b);
                        const best       = batteries.reduce((a, b) => healthData[a].current_soh > healthData[b].current_soh ? a : b);
                        const critical   = batteries.filter(b => healthData[b].status === "Critical").length;
                        const totalAnom  = batteries.flatMap(b => healthData[b].anomalies).length;
                        const fleetStatus = critical === batteries.length ? "ALL CRITICAL" : critical > 0 ? `${critical}/${batteries.length} CRITICAL` : "FLEET HEALTHY";
                        const fleetColor  = critical === batteries.length ? "var(--accent-red)" : critical > 0 ? "var(--accent-yellow)" : "var(--accent-green)";
                        return [
                            { label: "WORST BATTERY",         value: worst,       sub: `SOH ${healthData[worst].current_soh}%`,  color: "var(--accent-red)",   extra: healthData[worst].status  },
                            { label: "BEST BATTERY",          value: best,        sub: `SOH ${healthData[best].current_soh}%`,   color: "var(--accent-green)", extra: healthData[best].status   },
                            { label: "FLEET STATUS",          value: fleetStatus, sub: `${batteries.length} batteries monitored`, color: fleetColor },
                            { label: "TOTAL FLEET ANOMALIES", value: totalAnom,   sub: "Cycles below 80% SOH across all",        color: totalAnom > 0 ? "var(--accent-red)" : "var(--accent-green)" },
                        ].map(c => (
                            <div key={c.label} style={{ background: "var(--bg-secondary)", border: `1px solid ${c.color}33`, borderRadius: 8, padding: "14px 18px", boxShadow: `0 0 16px ${c.color}11` }}>
                                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 7, letterSpacing: 2, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 6 }}>{c.label}</div>
                                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, fontWeight: 900, color: c.color, textShadow: `0 0 20px ${c.color}55`, display: "flex", alignItems: "baseline", gap: 8 }}>
                                    {c.value}
                                    {c.extra && <span style={{ fontSize: 8, letterSpacing: 1.5, padding: "2px 7px", borderRadius: 6, color: getStatusColor(c.extra), background: `${getStatusColor(c.extra)}18`, border: `1px solid ${getStatusColor(c.extra)}44` }}>{c.extra.toUpperCase()}</span>}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>{c.sub}</div>
                            </div>
                        ));
                    })()}
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                    {[
                        { label: "CURRENT SOH",       value: `${avgSoh}%`,      color: getSohColor(parseFloat(avgSoh)), sub: healthData[graphBattery].status },
                        { label: "EOL REACHED",        value: earliestEol === "N/A" ? "N/A" : `Cycle #${earliestEol}`, color: "var(--accent-orange)", sub: "First cycle SOH < 80%" },
                        { label: "ANOMALY CYCLES",     value: allAnomalies,      color: allAnomalies > 0 ? "var(--accent-red)" : "var(--accent-green)", sub: "Cycles below 80% SOH" },
                        { label: "LAST RUNTIME",       value: `${healthData[graphBattery].discharge_dur_min.at(-1).toFixed(1)} min`, color: "var(--accent-cyan)", sub: "Last discharge duration" },
                    ].map(c => (
                        <div key={c.label} style={{ background: "var(--bg-secondary)", border: `1px solid ${c.color}33`, borderRadius: 8, padding: "14px 18px", boxShadow: `0 0 16px ${c.color}11` }}>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 7, letterSpacing: 2, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 6 }}>{c.label}</div>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, fontWeight: 900, color: c.color, textShadow: `0 0 20px ${c.color}55` }}>{c.value}</div>
                            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>{c.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Battery selector ── */}
            <div className="card" style={{ borderRadius: 4 }}>
                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 7, letterSpacing: 2, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase" }}>
                    GRAPH VIEW — SELECT ONE BATTERY OR ALL
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                        onClick={() => setGraphBattery("ALL")}
                        style={{ background: graphBattery === "ALL" ? "rgba(255,255,255,0.08)" : "transparent", border: `1px solid ${graphBattery === "ALL" ? "rgba(255,255,255,0.4)" : "var(--border)"}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 1.5, color: graphBattery === "ALL" ? "#fff" : "var(--text-secondary)", transition: "all 0.2s" }}>
                        ALL
                    </button>
                    {batteries.map(bat => {
                        const active = graphBattery === bat;
                        const color  = PALETTE[bat];
                        return (
                            <button key={bat} onClick={() => setGraphBattery(bat)}
                                style={{ background: active ? `${color}18` : "transparent", border: `1px solid ${active ? color : "var(--border)"}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 1.5, color: active ? color : "var(--text-secondary)", transition: "all 0.2s", boxShadow: active ? `0 0 10px ${color}33` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? color : "var(--border)", boxShadow: active ? `0 0 5px ${color}` : "none" }} />
                                {bat}
                            </button>
                        );
                    })}
                    <span style={{ marginLeft: "auto", fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 1.5, padding: "3px 12px", borderRadius: 10, color: allAnomalies > 0 ? "var(--accent-red)" : "var(--accent-green)", background: allAnomalies > 0 ? "rgba(255,45,85,0.1)" : "rgba(0,255,136,0.08)", border: `1px solid ${allAnomalies > 0 ? "rgba(255,45,85,0.3)" : "rgba(0,255,136,0.25)"}` }}>
                        {allAnomalies > 0 ? `${allAnomalies} ANOMALY CYCLES` : "NO ANOMALIES"}
                    </span>
                </div>
            </div>

            {/* ── Metric tabs ── */}
            <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 8, padding: 4, border: "1px solid var(--border)" }}>
                {metrics.map(m => (
                    <button key={m.key} onClick={() => setActiveMetric(m.key)} style={{ flex: 1, background: activeMetric === m.key ? `linear-gradient(135deg,${m.color}18,${m.color}08)` : "transparent", border: activeMetric === m.key ? `1px solid ${m.color}55` : "1px solid transparent", borderRadius: 6, padding: "9px 16px", cursor: "pointer", fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 2, color: activeMetric === m.key ? m.color : "var(--text-secondary)", transition: "all 0.25s", textTransform: "uppercase" }}>
                        {m.label}
                    </button>
                ))}
            </div>

            {/* ── Main chart ── */}
            <div className="card" style={{ borderRadius: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 2, color: "var(--accent-cyan)" }}>
                        {currentMetric.label} — FADE OVER CYCLES
                        {graphBattery !== "ALL" && (
                            <span style={{ color: PALETTE[graphBattery], marginLeft: 10 }}>· {graphBattery}</span>
                        )}
                    </span>
                    <div style={{ display: "flex", gap: 12 }}>
                        {graphSelected.map(bat => (
                            <span key={bat} style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, color: PALETTE[bat], display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ width: 18, height: 2, background: PALETTE[bat], display: "inline-block", borderRadius: 1 }} />{bat}
                            </span>
                        ))}
                    </div>
                </div>
                <div style={{ height: 280, width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 20, left: 8, bottom: 28 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} label={axLabel("CYCLE NUMBER")} />
                            <YAxis stroke="#4a6a8a" tick={axTick} tickFormatter={v => `${v.toFixed(0)}${currentMetric.unit}`} width={52} />
                            <Tooltip content={<HealthTooltip unit={currentMetric.unit} />} />
                            {activeMetric === "soh_pct" && (
                                <ReferenceLine y={80} stroke="rgba(255,45,85,0.6)" strokeDasharray="4 4" strokeWidth={1.5}
                                    label={{ value: "EOL 80%", position: "insideTopRight", fill: "rgba(255,45,85,0.8)", fontSize: 8, fontFamily: "'Orbitron',monospace" }} />
                            )}
                            {graphSelected.map(bat => (
                                <Line key={bat} type="monotone" dataKey={bat} name={bat}
                                    stroke={PALETTE[bat]} strokeWidth={2}
                                    dot={props => {
                                        const isAnomaly = chartData[props.index]?.[`${bat}_anomaly`];
                                        if (!isAnomaly) return <g key={props.key} />;
                                        return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill="var(--accent-red)" stroke="var(--bg-card)" strokeWidth={1.5} />;
                                    }}
                                    activeDot={{ r: 5 }} isAnimationActive={false}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent-red)", display: "inline-block", boxShadow: "0 0 5px var(--accent-red)" }} />
                    <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Red dots = anomaly cycle (SOH dropped below 80%)</span>
                </div>
            </div>

            {/* ── Cycle range sliders ── */}
            <div className="card" style={{ borderRadius: 4 }}>
                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 7, letterSpacing: 2, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase" }}>
                    CYCLE RANGE — {cycleRange[0]}% → {cycleRange[1]}% of total cycles
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, color: "var(--text-secondary)", minWidth: 32 }}>{cycleRange[0]}%</span>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                        <input type="range" min={0} max={cycleRange[1] - 5} value={cycleRange[0]}
                            onChange={e => setCycleRange([+e.target.value, cycleRange[1]])}
                            style={{ width: "100%", accentColor: "var(--accent-cyan)" }} />
                        <input type="range" min={cycleRange[0] + 5} max={100} value={cycleRange[1]}
                            onChange={e => setCycleRange([cycleRange[0], +e.target.value])}
                            style={{ width: "100%", accentColor: "var(--accent-green)" }} />
                    </div>
                    <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, color: "var(--text-secondary)", minWidth: 32 }}>{cycleRange[1]}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8, fontSize: 10, color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--accent-cyan)" }}>▬ START</span>
                    <span style={{ color: "var(--accent-green)" }}>▬ END</span>
                </div>
            </div>

        </div>
    );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────
export default function NASADataExplorer() {
    const first = nasaData[0];
    const last  = nasaData[nasaData.length - 1];
    const [tableOpen, setTableOpen] = useState(false);
    const [nasaTab, setNasaTab]     = useState("archive");

    const fadeRate      = ((first.capacity - last.capacity) / last.cycle).toFixed(4);
    const avgEfficiency = (nasaData.reduce((s, d) => s + d.efficiency, 0) / nasaData.length).toFixed(2);

    return (
        <div style={{ animation: "fadeIn 0.5s ease-out" }}>

            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, borderBottom: "1px solid rgba(0, 207, 255, 0.2)", paddingBottom: 16 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 24, color: "var(--accent-cyan)", textShadow: "0 0 16px rgba(0,207,255,0.4)" }}>NASA AMES DATASET</span>
                        <InfoButton infoKey="dataset" />
                    </div>
                </div>
                <div style={{ padding: "6px 12px", background: "rgba(255, 214, 10, 0.1)", border: "1px solid rgba(255, 214, 10, 0.3)", borderRadius: 4, fontFamily: "'Orbitron', monospace", fontSize: 10, color: "var(--accent-yellow)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                    OFFLINE ARCHIVE VERIFIED
                </div>
            </div>

            {/* ── TAB SWITCHER ── */}
            <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 8, padding: 4, border: "1px solid var(--border)", marginBottom: 24 }}>
                {[
                    { id: "archive", label: "ARCHIVE DATA",   icon: "◎" },
                    { id: "health",  label: "BATTERY HEALTH", icon: "⬡" },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setNasaTab(tab.id)}
                        style={{
                            flex: 1,
                            background: nasaTab === tab.id
                                ? "linear-gradient(135deg, rgba(0,207,255,0.12), rgba(0,255,136,0.08))"
                                : "transparent",
                            border: nasaTab === tab.id
                                ? "1px solid rgba(0,207,255,0.3)"
                                : "1px solid transparent",
                            borderRadius: 6, padding: "9px 16px", cursor: "pointer",
                            fontFamily: "'Orbitron', monospace", fontSize: 8, letterSpacing: 2,
                            color: nasaTab === tab.id ? "var(--accent-cyan)" : "var(--text-secondary)",
                            transition: "all 0.25s ease",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            boxShadow: nasaTab === tab.id ? "0 0 12px rgba(0,207,255,0.08)" : "none",
                        }}
                    >
                        <span style={{ fontSize: 12 }}>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── TAB 1: ARCHIVE DATA ── */}
            {nasaTab === "archive" && (
                <>
                    <div className="metric-row" style={{ marginBottom: 24 }}>
                        <MetricCard label="TOTAL CYCLES"     value={last.cycle}                icon="⟳"  color="orange" infoKey="totalCycles"         />
                        <MetricCard label="INITIAL CAPACITY" value={first.capacity.toFixed(2)} unit="Ah" icon="⚡" color="green"  infoKey="initialCapacity"    />
                        <MetricCard label="FINAL CAPACITY"   value={last.capacity.toFixed(2)}  unit="Ah" icon="↓"  color="red"    infoKey="finalCapacity"      />
                        <MetricCard label="END-OF-LIFE SOH"  value={`${last.soh.toFixed(1)}%`} icon="⚠"  color="red"    infoKey="eolSoh" trend="EoL"  />
                        <MetricCard label="AVG EFFICIENCY"   value={`${avgEfficiency}%`}        icon="η"  color="cyan"   infoKey="coulombicEfficiency" />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                        <div className="card" style={{ borderRadius: 4, padding: "14px 18px" }}>
                            <div style={{ fontSize: 9, color: "var(--text-secondary)", letterSpacing: 1.5, fontFamily: "'Orbitron', monospace", marginBottom: 4 }}>CAPACITY FADE RATE</div>
                            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 18, fontWeight: 700, color: "var(--accent-cyan)" }}>
                                {fadeRate} <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 400 }}>Ah/cycle</span>
                            </div>
                        </div>
                        <div className="card" style={{ borderRadius: 4, padding: "14px 18px" }}>
                            <div style={{ fontSize: 9, color: "var(--text-secondary)", letterSpacing: 1.5, fontFamily: "'Orbitron', monospace", marginBottom: 4 }}>THERMAL RISE (BoL → EoL)</div>
                            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 18, fontWeight: 700, color: "var(--accent-yellow)" }}>
                                +{(last.peak_temp - first.peak_temp).toFixed(1)} <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 400 }}>°C</span>
                            </div>
                        </div>
                        <div className="card" style={{ borderRadius: 4, padding: "14px 18px" }}>
                            <div style={{ fontSize: 9, color: "var(--text-secondary)", letterSpacing: 1.5, fontFamily: "'Orbitron', monospace", marginBottom: 4 }}>EFFICIENCY DROP</div>
                            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 18, fontWeight: 700, color: "var(--accent-red)" }}>
                                -{(first.efficiency - last.efficiency).toFixed(1)} <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 400 }}>%</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid-main">
                        <div className="card span-2" style={{ borderRadius: 4 }}>
                            <ChartTitle color="cyan" label="Capacity Degradation Curve" infoKey="capacityDegradation" />
                            <div style={{ height: 320, width: "100%" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={nasaData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="capGradNasa" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#00cfff" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#00cfff" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} label={axLabel("CYCLE NUMBER")} />
                                        <YAxis stroke="#4a6a8a" domain={["auto","auto"]} tick={axTick}
                                            label={{ value: "CAPACITY (Ah)", angle: -90, position: "insideLeft", offset: 15, fill: "#7a9bbf", fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 2, style: { textAnchor: "middle" } }} />
                                        <Tooltip contentStyle={ttStyle} itemStyle={ttItem("var(--accent-cyan)")} labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }} />
                                        <Area type="monotone" dataKey="capacity" stroke="var(--accent-cyan)" strokeWidth={3} fill="url(#capGradNasa)" activeDot={{ r: 6, fill: "var(--bg-primary)", stroke: "var(--accent-cyan)", strokeWidth: 2 }} />
                                        <Line type="step" dataKey={() => 1.54} stroke="var(--accent-red)" strokeWidth={1} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 10px", marginTop: 10 }}>
                                <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}><span style={{ color: "var(--accent-cyan)", marginRight: 6 }}>■</span>Actual Capacity</span>
                                <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}><span style={{ color: "var(--accent-red)", marginRight: 6 }}>--</span>EoL Threshold (70%)</span>
                            </div>
                        </div>

                        <div className="card span-1" style={{ borderRadius: 4 }}>
                            <ChartTitle color="yellow" label="Peak Thermal Drift" infoKey="peakThermal" />
                            <div style={{ height: 320, width: "100%" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={nasaData} margin={{ top: 20, right: 30, left: -20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} />
                                        <YAxis domain={["auto","auto"]} stroke="#4a6a8a" tick={axTick} />
                                        <Tooltip contentStyle={ttStyle} itemStyle={ttItem("var(--accent-yellow)")} />
                                        <Line type="monotone" dataKey="peak_temp" name="Peak Temp (°C)" stroke="var(--accent-yellow)" strokeWidth={2} dot={{ r: 2, fill: "var(--accent-yellow)" }} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 10, textAlign: "center" }}>
                                Internal resistance growth causes higher peak temperatures over aging.
                            </div>
                        </div>

                        <div className="card span-2" style={{ borderRadius: 4 }}>
                            <ChartTitle color="green" label="Coulombic Efficiency Trend" infoKey="coulombicEfficiency" />
                            <div style={{ height: 260, width: "100%" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={nasaData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#00ff88" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#00ff88" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} label={axLabel("CYCLE NUMBER")} />
                                        <YAxis stroke="#4a6a8a" domain={[91, 100]} tick={axTick} tickFormatter={v => `${v}%`}
                                            label={{ value: "EFFICIENCY (%)", angle: -90, position: "insideLeft", offset: 15, fill: "#7a9bbf", fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 2, style: { textAnchor: "middle" } }} />
                                        <Tooltip contentStyle={ttStyle} itemStyle={ttItem("var(--accent-green)")} formatter={(val) => [`${val}%`, "η_Coulombic"]} labelFormatter={(c) => `Cycle ${c}`} />
                                        <Area type="monotone" dataKey="efficiency" stroke="var(--accent-green)" strokeWidth={2} fill="url(#effGrad)" activeDot={{ r: 5, fill: "var(--bg-primary)", stroke: "var(--accent-green)", strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="card span-1" style={{ borderRadius: 4 }}>
                            <ChartTitle color="cyan" label="Charge & Discharge Duration" infoKey="chargeDischargeTime" />
                            <div style={{ height: 260, width: "100%" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={nasaData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} />
                                        <YAxis stroke="#4a6a8a" tick={axTick} tickFormatter={v => `${(v / 60).toFixed(0)}m`} />
                                        <Tooltip contentStyle={ttStyle} formatter={(val, name) => [`${(val / 60).toFixed(1)} min`, name === "charge_time" ? "Charge" : "Discharge"]} labelFormatter={(c) => `Cycle ${c}`} />
                                        <Bar  dataKey="charge_time"    name="charge_time"    fill="rgba(0,207,255,0.35)" radius={[2,2,0,0]} />
                                        <Line dataKey="discharge_time" name="discharge_time" stroke="var(--accent-orange)" strokeWidth={2} dot={{ r: 2, fill: "var(--accent-orange)" }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
                                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}><span style={{ color: "var(--accent-cyan)", marginRight: 4 }}>█</span>Charge</span>
                                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}><span style={{ color: "var(--accent-orange)", marginRight: 4 }}>—</span>Discharge</span>
                            </div>
                        </div>

                        <div className="card span-3" style={{ borderRadius: 4 }}>
                            <ChartTitle color="cyan" label="Experiment Parameters & Hybrid Validation" infoKey="simulationBridge" />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                        <span style={{ fontSize: 9, color: "var(--text-secondary)", letterSpacing: 1.5, fontFamily: "'Orbitron', monospace" }}>CHARGE PROFILE</span>
                                        <InfoButton infoKey="chargeProfile" />
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>1.5A CC to 4.2V, then CV until I &lt; 20mA</div>
                                </div>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                        <span style={{ fontSize: 9, color: "var(--text-secondary)", letterSpacing: 1.5, fontFamily: "'Orbitron', monospace" }}>DISCHARGE PROFILE</span>
                                        <InfoButton infoKey="dischargeProfile" />
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>2A CC discharging to 2.7V</div>
                                </div>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                        <span style={{ fontSize: 9, color: "var(--text-secondary)", letterSpacing: 1.5, fontFamily: "'Orbitron', monospace" }}>SIMULATION BRIDGE</span>
                                        <InfoButton infoKey="simulationBridge" />
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--accent-green)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>When offline, main dashboard models emulate this B0005 dataset to prevent fake/flatline inputs.</div>
                                </div>
                            </div>
                        </div>

                        <div className="card span-3" style={{ borderRadius: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }} onClick={() => setTableOpen(o => !o)}>
                                <div className="card-title cyan" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
                                    Raw Cycle Data Table <InfoButton infoKey="rawDataTable" />
                                </div>
                                <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, color: "var(--text-secondary)", letterSpacing: 1 }}>
                                    {tableOpen ? "▲ COLLAPSE" : "▼ EXPAND"} &nbsp; ({nasaData.length} records)
                                </span>
                            </div>
                            {tableOpen && (
                                <div style={{ marginTop: 16, overflowX: "auto" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 1fr 1fr", gap: "0 12px", paddingBottom: 8, borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                                        {["CYCLE","CAPACITY (Ah)","SOH (%)","PEAK TEMP (°C)","EFFICIENCY (%)","CHARGE (s)","DISCHARGE (s)"].map(h => (
                                            <span key={h} style={{ fontFamily: "'Orbitron', monospace", fontSize: 7, letterSpacing: 1.5, color: "var(--text-secondary)", textTransform: "uppercase" }}>{h}</span>
                                        ))}
                                    </div>
                                    {nasaData.map((row, i) => (
                                        <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 1fr 1fr", gap: "0 12px", padding: "8px 0", borderBottom: "1px solid rgba(26,42,74,0.5)", alignItems: "center" }}>
                                            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 12, fontWeight: 700, color: "var(--accent-cyan)" }}>{row.cycle}</span>
                                            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: "var(--text-primary)" }}>{row.capacity.toFixed(2)}</span>
                                            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 12, fontWeight: 700, color: row.soh > 80 ? "var(--accent-green)" : row.soh > 70 ? "var(--accent-yellow)" : "var(--accent-red)" }}>{row.soh.toFixed(1)}</span>
                                            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: row.peak_temp > 40 ? "var(--accent-red)" : row.peak_temp > 36 ? "var(--accent-yellow)" : "var(--text-primary)" }}>{row.peak_temp.toFixed(1)}</span>
                                            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: "var(--text-primary)" }}>{row.efficiency.toFixed(1)}</span>
                                            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: "var(--text-primary)" }}>{row.charge_time}</span>
                                            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: "var(--text-primary)" }}>{row.discharge_time}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ── TAB 2: BATTERY HEALTH ── */}
            {nasaTab === "health" && (
                <BatteryHealthTab healthData={healthData} />
            )}

        </div>
    );
}