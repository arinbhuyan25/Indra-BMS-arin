import { useState } from "react";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ── Degradation simulation from SoH ──────────────────────────
function computeDegradation(soh) {
    const fade = 100 - soh;
    const lliRatio = 0.62 + Math.sin(soh / 10) * 0.08;
    const lamPeRatio = 0.25 - Math.sin(soh / 15) * 0.04;
    const lamNeRatio = 1 - lliRatio - lamPeRatio;
    return {
        lli: parseFloat((fade * lliRatio).toFixed(2)),
        lamPe: parseFloat((fade * lamPeRatio).toFixed(2)),
        lamNe: parseFloat((fade * lamNeRatio).toFixed(2)),
        total: parseFloat(fade.toFixed(2)),
    };
}

function generatePeakShifts(soh) {
    const fade = 100 - soh;
    return [
        { peak: "P1 (3.45 V)", shift: parseFloat((fade * 0.003 * 1000).toFixed(1)) },
        { peak: "P2 (3.72 V)", shift: parseFloat((fade * 0.002 * 1000).toFixed(1)) },
        { peak: "P3 (4.05 V)", shift: parseFloat((fade * 0.001 * 1000).toFixed(1)) },
    ];
}

const PIE_COLORS = ["#00cfff", "#ff6b2b", "#ffd60a"];

const MODES = [
    { key: "lli", label: "LLI", full: "Loss of Lithium Inventory", desc: "All peaks shift right — lithium trapped in SEI layer.", color: "#00cfff", glow: "rgba(0,207,255,0.25)" },
    { key: "lamPe", label: "LAM_PE", full: "Positive Electrode Loss", desc: "Peak heights decrease, voltage positions remain stable.", color: "#ff6b2b", glow: "rgba(255,107,43,0.25)" },
    { key: "lamNe", label: "LAM_NE", full: "Negative Electrode Loss", desc: "Peaks shift left with reduced heights — graphite degradation.", color: "#ffd60a", glow: "rgba(255,214,10,0.25)" },
];

export default function AnalyticsPage({ soh }) {
    const deg = computeDegradation(soh);
    const peaks = generatePeakShifts(soh);
    const pieData = MODES.map(m => ({ name: m.label, value: deg[m.key] }));

    const [fleetSize, setFleetSize] = useState(1000);
    const [costPerGB, setCostPerGB] = useState(0.08);
    const usdToInr = 83;
    const rawGBperVehYear = (5 * 24 * 365) / 1024;
    const edgeGBperVehYear = 0.00005 * 365;
    const savedGB = (rawGBperVehYear - edgeGBperVehYear) * fleetSize;
    const savedINR = savedGB * costPerGB * usdToInr;
    const savedUSD = savedGB * costPerGB;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative", zIndex: 1 }}>

            {/* ── PAGE HERO BANNER ── */}
            <div className="card" style={{
                background: "linear-gradient(135deg, rgba(0,207,255,0.06), rgba(0,255,136,0.04))",
                borderColor: "rgba(0,207,255,0.25)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "16px 24px",
            }}>
                <div>
                    <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 13, letterSpacing: 3, color: "var(--accent-cyan)", textShadow: "var(--glow-cyan)" }}>
                        WHITE-BOX DEGRADATION ANALYSIS
                    </div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                        Physics-informed breakdown — explaining <em>why</em> the battery is aging, not just <em>that</em> it is.
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-green)", animation: "pulse 1.5s infinite", boxShadow: "var(--glow-green)", display: "inline-block" }} />
                    <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 9, color: "var(--accent-green)", letterSpacing: 1.5 }}>LIVE ANALYSIS</span>
                </div>
            </div>

            {/* ── ROW 1: Pie Chart + Mode Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>

                {/* Donut chart */}
                <div className="card">
                    <div className="card-title cyan">Degradation Mode Breakdown</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ width: "100%", maxWidth: 260, minWidth: 180, height: 240, margin: "0 auto" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <defs>
                                        {PIE_COLORS.map((c, i) => (
                                            <filter key={i} id={`glow-${i}`}><feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={c} floodOpacity="0.5" /></filter>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={pieData} dataKey="value" nameKey="name"
                                        cx="50%" cy="50%" outerRadius={85} innerRadius={48}
                                        paddingAngle={3} strokeWidth={0}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={{ stroke: "#4a6a8a", strokeWidth: 1 }}
                                    >
                                        {pieData.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i]} style={{ filter: `url(#glow-${i})` }} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: 8, fontSize: 11, fontFamily: "'Plus Jakarta Sans'" }}
                                        formatter={v => [`${v.toFixed(2)}%`, "Capacity Fade"]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Centre stats */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                            {MODES.map((m, i) => (
                                <div key={i} style={{
                                    padding: "12px 16px", borderRadius: 10,
                                    background: `${m.color}08`,
                                    border: `1px solid ${m.color}30`,
                                    transition: "all 0.3s",
                                    cursor: "default",
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                        <span style={{ fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 2, color: m.color }}>{m.label}</span>
                                        <span style={{ fontFamily: "'Orbitron'", fontSize: 16, fontWeight: 900, color: m.color, textShadow: `0 0 12px ${m.glow}` }}>
                                            {deg[m.key]}%
                                        </span>
                                    </div>
                                    {/* Mini bar */}
                                    <div style={{ height: 3, background: "var(--bg-secondary)", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                                        <div style={{ height: "100%", width: `${deg.total > 0 ? (deg[m.key] / deg.total * 100) : 0}%`, background: m.color, borderRadius: 2, transition: "width 1s ease", boxShadow: `0 0 6px ${m.glow}` }} />
                                    </div>
                                    <div style={{ fontSize: 10, color: "#b8d4f0", lineHeight: 1.5 }}>{m.desc}</div>
                                </div>
                            ))}
                            {/* Total fade */}
                            <div style={{
                                padding: "10px 16px", borderRadius: 10,
                                background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.25)",
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                            }}>
                                <span style={{ fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 2, color: "var(--accent-red)" }}>TOTAL FADE</span>
                                <span style={{ fontFamily: "'Orbitron'", fontSize: 20, fontWeight: 900, color: "var(--accent-red)", textShadow: "0 0 14px rgba(255,45,85,0.35)" }}>
                                    {deg.total}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Peak shift bar chart */}
                <div className="card">
                    <div className="card-title orange">Peak Voltage Shift Analysis</div>
                    <div className="bar-chart-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={peaks} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
                                <defs>
                                    <linearGradient id="barGradUnified" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#00cfff" stopOpacity={0.7} />
                                        <stop offset="100%" stopColor="#00cfff" stopOpacity={0.15} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="peak" stroke="#4a6a8a"
                                    tick={{ fontSize: "0.56rem", fill: "#c4ddf5", fontFamily: "'Plus Jakarta Sans'" }} />
                                <YAxis stroke="#4a6a8a"
                                    tick={{ fontSize: "0.625rem", fill: "#c4ddf5", fontFamily: "'Plus Jakarta Sans'" }}
                                    tickFormatter={v => `${v} mV`} width={50}
                                    label={{ value: "SHIFT (mV)", angle: -90, position: "insideLeft", offset: 8, fill: "#9ab8d8", fontSize: "0.5rem", fontFamily: "'Orbitron'", letterSpacing: 2, style: { textAnchor: "middle" } }} />
                                <Tooltip
                                    cursor={{ fill: "rgba(0, 207, 255, 0.06)" }}
                                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: 8, fontSize: "0.69rem" }}
                                    formatter={v => [`${v} mV`, "Peak Shift"]} />
                                <Bar dataKey="shift" fill="url(#barGradUnified)" radius={[6, 6, 0, 0]} barSize={44} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Diagnostic */}
                    <div style={{
                        marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: 10,
                        background: "linear-gradient(135deg, rgba(0,207,255,0.06), rgba(0,255,136,0.04))",
                        border: "1px solid rgba(0,207,255,0.2)",
                    }}>
                        <span style={{ fontFamily: "'Orbitron'", fontSize: "0.5rem", letterSpacing: 2, color: "var(--accent-cyan)" }}>DIAGNOSTIC: </span>
                        <span style={{ fontSize: "0.69rem", color: "var(--text-primary)" }}>
                            {deg.lli > deg.lamPe + deg.lamNe
                                ? `${((deg.lli / deg.total) * 100).toFixed(0)}% capacity fade attributed to LLI + ${((deg.lamPe / deg.total) * 100).toFixed(0)}% LAM_PE — anode SEI growth dominant.`
                                : "Active material loss dominates — consider thermal management review."}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── ROW 2: Edge vs Cloud ROI Calculator ── */}
            <div className="card">
                <div className="card-title green">Edge vs. Cloud — Fleet ROI Calculator</div>

                <div className="roi-grid">
                    {/* ── Sliders ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {[
                            { label: "FLEET SIZE", value: fleetSize.toLocaleString(), min: 10, max: 100000, step: 10, val: fleetSize, set: setFleetSize, unit: "EVs" },
                            { label: "CLOUD COST / GB", value: `$${costPerGB.toFixed(2)}`, min: 0.01, max: 0.50, step: 0.01, val: costPerGB, set: setCostPerGB, unit: "USD" },
                        ].map((s, i) => (
                            <div key={i}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                    <span className="roi-slider-label">{s.label}</span>
                                    <span className="roi-slider-value">{s.value}</span>
                                </div>
                                <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                                    onChange={e => s.set(+e.target.value)}
                                    className="roi-range" />
                                <div className="roi-range-bounds">
                                    <span>{s.min}</span><span>{s.max.toLocaleString()} {s.unit}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Cost comparison ── */}
                    <div className="roi-cost-col">
                        {/* Cloud cost */}
                        <div className="roi-cost-card" style={{
                            background: "linear-gradient(135deg, rgba(255,45,85,0.08), rgba(255,45,85,0.03))",
                            border: "1px solid rgba(255,45,85,0.2)",
                        }}>
                            <div className="roi-cost-label" style={{ color: "var(--accent-red)" }}>CLOUD-ONLY ANNUAL COST</div>
                            <div className="roi-cost-value" style={{ color: "var(--accent-red)", textDecoration: "line-through", opacity: 0.65 }}>
                                ₹{(rawGBperVehYear * fleetSize * costPerGB * usdToInr).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="roi-cost-sub">
                                {(rawGBperVehYear * fleetSize).toLocaleString(undefined, { maximumFractionDigits: 0 })} GB/yr ingress
                            </div>
                        </div>
                        {/* Edge cost */}
                        <div className="roi-cost-card" style={{
                            background: "linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,255,136,0.03))",
                            border: "1px solid rgba(0,255,136,0.25)",
                        }}>
                            <div className="roi-cost-label" style={{ color: "var(--accent-green)" }}>WITH INDRA-BMS (EDGE)</div>
                            <div className="roi-cost-value" style={{ color: "var(--accent-green)", textShadow: "var(--glow-green)" }}>
                                ₹{(edgeGBperVehYear * fleetSize * costPerGB * usdToInr).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="roi-cost-sub">
                                {(edgeGBperVehYear * fleetSize).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB/yr ingress
                            </div>
                        </div>
                    </div>

                    {/* ── Net Savings ── */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem" }}>
                        <div className="roi-slider-label">ANNUAL SAVINGS</div>
                        <div className="roi-savings-number">
                            ₹{savedINR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: "0.69rem", color: "var(--text-secondary)" }}>
                            ${savedUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
                        </div>
                        <div className="roi-badge">
                            {savedGB.toLocaleString(undefined, { maximumFractionDigits: 0 })} GB SAVED/YR
                        </div>
                        <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.7, marginTop: "0.125rem" }}>
                            99.95% data reduction<br />50 bytes/cycle vs. 5 MB/hour
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
