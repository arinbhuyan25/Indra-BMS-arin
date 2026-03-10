import { useState } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar, ComposedChart
} from "recharts";
import nasaData from "./nasa_mock_data.json";
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

// ─── MAIN COMPONENT ─────────────────────────────────────────
export default function NASADataExplorer() {
    const first = nasaData[0];
    const last = nasaData[nasaData.length - 1];
    const [tableOpen, setTableOpen] = useState(false);

    // Derived metrics
    const fadeRate = ((first.capacity - last.capacity) / last.cycle).toFixed(4);
    const avgEfficiency = (nasaData.reduce((s, d) => s + d.efficiency, 0) / nasaData.length).toFixed(2);

    return (
        <div style={{ animation: "fadeIn 0.5s ease-out" }}>
            {/* HEADER */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-end",
                marginBottom: 24, borderBottom: "1px solid rgba(0, 207, 255, 0.2)", paddingBottom: 16,
            }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                            fontFamily: "'Orbitron', monospace", fontSize: 24, color: "var(--accent-cyan)",
                            textShadow: "0 0 16px rgba(0,207,255,0.4)",
                        }}>NASA AMES DATASET</span>
                        <InfoButton infoKey="dataset" />
                    </div>
                    <div style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13,
                        color: "var(--text-secondary)", marginTop: 4, letterSpacing: 0.5,
                    }}>BATT_B0005 — Accelerated Aging Profile &nbsp;|&nbsp; 18650 Li-Ion &nbsp;|&nbsp; Room Temp</div>
                </div>
                <div style={{
                    padding: "6px 12px", background: "rgba(255, 214, 10, 0.1)",
                    border: "1px solid rgba(255, 214, 10, 0.3)", borderRadius: 4,
                    fontFamily: "'Orbitron', monospace", fontSize: 10, color: "var(--accent-yellow)",
                    letterSpacing: 1.5, textTransform: "uppercase",
                }}>OFFLINE ARCHIVE VERIFIED</div>
            </div>

            {/* METRICS ROW */}
            <div className="metric-row" style={{ marginBottom: 24 }}>
                <MetricCard label="TOTAL CYCLES" value={last.cycle} icon="⟳" color="orange" infoKey="totalCycles" />
                <MetricCard label="INITIAL CAPACITY" value={first.capacity.toFixed(2)} unit="Ah" icon="⚡" color="green" infoKey="initialCapacity" />
                <MetricCard label="FINAL CAPACITY" value={last.capacity.toFixed(2)} unit="Ah" icon="↓" color="red" infoKey="finalCapacity" />
                <MetricCard label="END-OF-LIFE SOH" value={`${last.soh.toFixed(1)}%`} icon="⚠" color="red" infoKey="eolSoh" trend="EoL" />
                <MetricCard label="AVG EFFICIENCY" value={`${avgEfficiency}%`} icon="η" color="cyan" infoKey="coulombicEfficiency" />
            </div>

            {/* DERIVED STATS ROW */}
            <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20,
            }}>
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
                {/* ── 1. CAPACITY DEGRADATION CHART (span-2) ────────────── */}
                <div className="card span-2" style={{ borderRadius: 4 }}>
                    <ChartTitle color="cyan" label="Capacity Degradation Curve" infoKey="capacityDegradation" />
                    <div style={{ height: 320, width: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={nasaData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="capGradNasa" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00cfff" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#00cfff" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} label={axLabel("CYCLE NUMBER")} />
                                <YAxis stroke="#4a6a8a" domain={['auto', 'auto']} tick={axTick}
                                    label={{ value: "CAPACITY (Ah)", angle: -90, position: "insideLeft", offset: 15, fill: "#7a9bbf", fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 2, style: { textAnchor: "middle" } }} />
                                <Tooltip contentStyle={ttStyle} itemStyle={ttItem("var(--accent-cyan)")} labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }} />
                                <Area type="monotone" dataKey="capacity" stroke="var(--accent-cyan)" strokeWidth={3} fill="url(#capGradNasa)" activeDot={{ r: 6, fill: "var(--bg-primary)", stroke: "var(--accent-cyan)", strokeWidth: 2 }} />
                                <Line type="step" dataKey={() => 1.54} stroke="var(--accent-red)" strokeWidth={1} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0 10px", marginTop: 10 }}>
                        <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            <span style={{ color: "var(--accent-cyan)", marginRight: 6 }}>■</span> Actual Capacity
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            <span style={{ color: "var(--accent-red)", marginRight: 6 }}>--</span> EoL Threshold (70%)
                        </span>
                    </div>
                </div>

                {/* ── 2. PEAK THERMAL DRIFT (span-1) ────────────────────── */}
                <div className="card span-1" style={{ borderRadius: 4 }}>
                    <ChartTitle color="yellow" label="Peak Thermal Drift" infoKey="peakThermal" />
                    <div style={{ height: 320, width: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={nasaData} margin={{ top: 20, right: 30, left: -20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} />
                                <YAxis domain={['auto', 'auto']} stroke="#4a6a8a" tick={axTick} />
                                <Tooltip contentStyle={ttStyle} itemStyle={ttItem("var(--accent-yellow)")} />
                                <Line type="monotone" dataKey="peak_temp" name="Peak Temp (°C)" stroke="var(--accent-yellow)" strokeWidth={2} dot={{ r: 2, fill: "var(--accent-yellow)" }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 10, textAlign: "center" }}>
                        Internal resistance growth causes higher peak temperatures over aging.
                    </div>
                </div>

                {/* ── 3. COULOMBIC EFFICIENCY (span-2) ──────────────────── */}
                <div className="card span-2" style={{ borderRadius: 4 }}>
                    <ChartTitle color="green" label="Coulombic Efficiency Trend" infoKey="coulombicEfficiency" />
                    <div style={{ height: 260, width: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={nasaData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00ff88" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} label={axLabel("CYCLE NUMBER")} />
                                <YAxis stroke="#4a6a8a" domain={[91, 100]} tick={axTick}
                                    tickFormatter={v => `${v}%`}
                                    label={{ value: "EFFICIENCY (%)", angle: -90, position: "insideLeft", offset: 15, fill: "#7a9bbf", fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 2, style: { textAnchor: "middle" } }} />
                                <Tooltip contentStyle={ttStyle} itemStyle={ttItem("var(--accent-green)")}
                                    formatter={(val) => [`${val}%`, "η_Coulombic"]} labelFormatter={(c) => `Cycle ${c}`} />
                                <Area type="monotone" dataKey="efficiency" stroke="var(--accent-green)" strokeWidth={2} fill="url(#effGrad)" activeDot={{ r: 5, fill: "var(--bg-primary)", stroke: "var(--accent-green)", strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── 4. CHARGE / DISCHARGE TIME (span-1) ───────────────── */}
                <div className="card span-1" style={{ borderRadius: 4 }}>
                    <ChartTitle color="cyan" label="Charge & Discharge Duration" infoKey="chargeDischargeTime" />
                    <div style={{ height: 260, width: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={nasaData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="cycle" stroke="#4a6a8a" tick={axTick} />
                                <YAxis stroke="#4a6a8a" tick={axTick} tickFormatter={v => `${(v / 60).toFixed(0)}m`} />
                                <Tooltip contentStyle={ttStyle}
                                    formatter={(val, name) => [`${(val / 60).toFixed(1)} min`, name === "charge_time" ? "Charge" : "Discharge"]}
                                    labelFormatter={(c) => `Cycle ${c}`} />
                                <Bar dataKey="charge_time" name="charge_time" fill="rgba(0,207,255,0.35)" radius={[2, 2, 0, 0]} />
                                <Line type="monotone" dataKey="discharge_time" name="discharge_time" stroke="var(--accent-orange)" strokeWidth={2} dot={{ r: 2, fill: "var(--accent-orange)" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                            <span style={{ color: "var(--accent-cyan)", marginRight: 4 }}>█</span>Charge
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                            <span style={{ color: "var(--accent-orange)", marginRight: 4 }}>—</span>Discharge
                        </span>
                    </div>
                </div>

                {/* ── 5. EXPERIMENT PARAMETERS (span-3) ─────────────────── */}
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

                {/* ── 6. RAW DATA TABLE (span-3) ────────────────────────── */}
                <div className="card span-3" style={{ borderRadius: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                        onClick={() => setTableOpen(o => !o)}>
                        <div className="card-title cyan" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
                            Raw Cycle Data Table
                            <InfoButton infoKey="rawDataTable" />
                        </div>
                        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, color: "var(--text-secondary)", letterSpacing: 1 }}>
                            {tableOpen ? "▲ COLLAPSE" : "▼ EXPAND"} &nbsp; ({nasaData.length} records)
                        </span>
                    </div>

                    {tableOpen && (
                        <div style={{ marginTop: 16, overflowX: "auto" }}>
                            {/* Table header */}
                            <div style={{
                                display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 1fr 1fr",
                                gap: "0 12px", paddingBottom: 8,
                                borderBottom: "1px solid var(--border)", marginBottom: 4,
                            }}>
                                {["CYCLE", "CAPACITY (Ah)", "SOH (%)", "PEAK TEMP (°C)", "EFFICIENCY (%)", "CHARGE (s)", "DISCHARGE (s)"].map(h => (
                                    <span key={h} style={{ fontFamily: "'Orbitron', monospace", fontSize: 7, letterSpacing: 1.5, color: "var(--text-secondary)", textTransform: "uppercase" }}>{h}</span>
                                ))}
                            </div>
                            {/* Rows */}
                            {nasaData.map((row, i) => (
                                <div key={i} style={{
                                    display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 1fr 1fr",
                                    gap: "0 12px", padding: "8px 0",
                                    borderBottom: "1px solid rgba(26,42,74,0.5)",
                                    alignItems: "center",
                                }}>
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
        </div>
    );
}
