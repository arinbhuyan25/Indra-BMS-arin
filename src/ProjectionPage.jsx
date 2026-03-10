import { useState, useEffect, useRef, useCallback } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import InfoButton from "./InfoButton";

// ── Projection engine ────────────────────────────────────────
function projectDegradation(startSoh, startCycle, totalCycles = 500) {
    const data = [];
    let soh = startSoh;
    for (let i = 0; i <= totalCycles; i++) {
        const cycle = startCycle + i;
        const fadeFactor = 0.04 + 0.0001 * i + (soh < 80 ? 0.02 : 0) + (soh < 70 ? 0.04 : 0);
        soh = Math.max(0, soh - fadeFactor - Math.random() * 0.01);
        data.push({ cycle, soh: parseFloat(soh.toFixed(2)), month: parseFloat((i / 30).toFixed(1)) });
        if (soh <= 0) break;
    }
    return data;
}

function findEOL(data, threshold = 80) {
    return data.find(d => d.soh <= threshold) ?? null;
}

function projectPeakShifts(startSoh, totalCycles = 500) {
    const data = [];
    let soh = startSoh;
    for (let i = 0; i <= totalCycles; i += 25) {
        const fade = 100 - soh;
        data.push({
            cycle: i,
            p1: parseFloat((3.45 + fade * 0.003).toFixed(3)),
            p2: parseFloat((3.72 + fade * 0.002).toFixed(3)),
            p3: parseFloat((4.05 + fade * 0.001).toFixed(3)),
        });
        soh = Math.max(0, soh - 25 * 0.04 - Math.random() * 0.5);
    }
    return data;
}

export default function ProjectionPage({ soh, cycle, voltage, current, connected }) {
    const [projData, setProjData] = useState(null);
    const [peakData, setPeakData] = useState(null);
    const [animData, setAnimData] = useState([]);
    const [running, setRunning] = useState(false);
    const [eol, setEol] = useState(null);
    const intervalRef = useRef(null);

    const runProjection = useCallback(() => {
        const full = projectDegradation(soh, cycle, 500);
        const peaks = projectPeakShifts(soh, 500);
        setProjData(full);
        setPeakData(peaks);
        setAnimData([]);
        setEol(findEOL(full, 80));
        setRunning(true);
    }, [soh, cycle]);

    useEffect(() => {
        if (!running || !projData) return;
        let idx = 0;
        const step = 5;
        intervalRef.current = setInterval(() => {
            idx += step;
            if (idx >= projData.length) {
                idx = projData.length;
                clearInterval(intervalRef.current);
                setRunning(false);
            }
            setAnimData(projData.slice(0, idx));
        }, 30);
        return () => clearInterval(intervalRef.current);
    }, [running, projData]);

    const stopProjection = () => {
        clearInterval(intervalRef.current);
        setRunning(false);
        setAnimData(projData ?? []);
    };

    const inputCards = [
        { label: "STATE OF HEALTH", value: `${soh.toFixed(1)}%`, color: soh > 85 ? "var(--accent-green)" : soh > 70 ? "var(--accent-yellow)" : "var(--accent-red)", src: "Current", glow: soh > 85 ? "var(--glow-green)" : "var(--glow-orange)" },
        { label: "PACK VOLTAGE", value: `${voltage} V`, color: "var(--accent-cyan)", src: connected ? "INA219 Live" : "Simulated", glow: "var(--glow-cyan)" },
        { label: "CURRENT", value: `${current} A`, color: "var(--accent-green)", src: connected ? "INA219 Live" : "Simulated", glow: "var(--glow-green)" },
        { label: "CHARGE CYCLE", value: `${cycle}`, color: "var(--accent-orange)", src: "Cumulative", glow: "var(--glow-orange)" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative", zIndex: 1 }}>

            {/* ── HERO BANNER ── */}
            <div className="card" style={{
                background: "linear-gradient(135deg, rgba(0,207,255,0.06), rgba(0,255,136,0.04))",
                borderColor: "rgba(0,207,255,0.25)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "16px 24px",
            }}>
                <div>
                    <div style={{ fontFamily: "'Orbitron'", fontSize: 13, letterSpacing: 3, color: "var(--accent-cyan)", textShadow: "var(--glow-cyan)" }}>
                        DIGITAL TWIN — DEGRADATION PROJECTION
                    </div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                        Fast-forward 500 charge cycles to predict battery End of Life from current state.
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {running && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-red)", animation: "pulse 0.8s infinite", boxShadow: "0 0 8px var(--accent-red)", display: "inline-block" }} />}
                    <span style={{ fontFamily: "'Orbitron'", fontSize: 9, color: running ? "var(--accent-red)" : "var(--text-secondary)", letterSpacing: 1.5 }}>
                        {running ? "SIMULATING..." : "IDLE"}
                    </span>
                </div>
            </div>

            {/* ── ROW 1: Live Input Cards + Run Button ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "stretch" }}>
                {inputCards.map((card, i) => (
                    <div key={i} className="card" style={{ padding: 16 }}>
                        <div style={{ fontFamily: "'Orbitron'", fontSize: 7, letterSpacing: 2.5, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase" }}>
                            {card.label}
                        </div>
                        <div style={{ fontFamily: "'Orbitron'", fontSize: 26, fontWeight: 900, color: card.color, textShadow: card.glow, lineHeight: 1 }}>
                            {card.value}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{
                                width: 5, height: 5, borderRadius: "50%",
                                background: connected ? "var(--accent-green)" : "var(--accent-cyan)",
                                boxShadow: connected ? "0 0 4px var(--accent-green)" : "0 0 4px var(--accent-cyan)",
                                display: "inline-block",
                            }} />
                            {card.src}
                        </div>
                    </div>
                ))}

                {/* Run / Stop */}
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
                    <button onClick={running ? stopProjection : runProjection} style={{
                        background: running
                            ? "linear-gradient(135deg, rgba(255,45,85,0.15), rgba(255,45,85,0.05))"
                            : "linear-gradient(135deg, rgba(0,207,255,0.15), rgba(0,255,136,0.1))",
                        border: `1px solid ${running ? "rgba(255,45,85,0.4)" : "rgba(0,207,255,0.35)"}`,
                        borderRadius: 12, cursor: "pointer",
                        fontFamily: "'Orbitron'", fontSize: 10, letterSpacing: 2,
                        color: running ? "var(--accent-red)" : "var(--accent-cyan)",
                        padding: "18px 28px",
                        transition: "all 0.3s",
                        boxShadow: running ? "0 0 24px rgba(255,45,85,0.15)" : "0 0 24px rgba(0,207,255,0.1)",
                    }}>
                        {running ? "◼ STOP" : "▶ RUN PROJECTION"}
                    </button>
                    <div style={{ fontFamily: "'Orbitron'", fontSize: 7, color: "var(--text-secondary)", textAlign: "center", letterSpacing: 1 }}>500 CYCLES · 100× SPEED</div>
                </div>
            </div>

            {/* ── ROW 2: SoH Projection Chart ── */}
            <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div className="card-title cyan" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Projected State of Health {animData.length > 0 ? `— ${animData.length} / 500 cycles` : ""}
                        <InfoButton infoKey="projSoh" />
                    </div>
                    {eol && (
                        <div style={{
                            padding: "5px 14px", borderRadius: 20,
                            background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.3)",
                            fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 1.5, color: "var(--accent-red)",
                            boxShadow: "0 0 10px rgba(255,45,85,0.1)",
                            animation: "pulse 2s infinite",
                        }}>
                            EOL @ CYCLE {eol.cycle} · MONTH {eol.month}
                        </div>
                    )}
                </div>

                <div style={{ width: "100%", height: 260 }}>
                    {animData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={animData} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
                                <defs>
                                    <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00cfff" stopOpacity={0.3} />
                                        <stop offset="50%" stopColor="#00cfff" stopOpacity={0.08} />
                                        <stop offset="95%" stopColor="#ff2d55" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="cycle" stroke="#4a6a8a"
                                    tick={{ fontSize: 10, fill: "#a8c4df", fontFamily: "'Plus Jakarta Sans'" }}
                                    label={{ value: "CHARGE CYCLE", position: "insideBottom", offset: -18, fill: "#7a9bbf", fontSize: 8, fontFamily: "'Orbitron'", letterSpacing: 2 }} />
                                <YAxis stroke="#4a6a8a"
                                    tick={{ fontSize: 10, fill: "#a8c4df", fontFamily: "'Plus Jakarta Sans'" }}
                                    domain={[0, 100]} tickFormatter={v => `${v}%`} width={42}
                                    label={{ value: "SOH %", angle: -90, position: "insideLeft", offset: 6, fill: "#7a9bbf", fontSize: 8, fontFamily: "'Orbitron'", letterSpacing: 2, style: { textAnchor: "middle" } }} />
                                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: 8, fontSize: 11 }}
                                    formatter={val => [`${val.toFixed(2)}%`, "SoH"]} labelFormatter={c => `Cycle ${c}`} />
                                <ReferenceLine y={80} stroke="var(--accent-red)" strokeDasharray="6 3"
                                    label={{ value: "80% EOL THRESHOLD", fill: "var(--accent-red)", fontSize: 8, fontFamily: "'Orbitron'" }} />
                                <Area type="monotone" dataKey="soh" stroke="var(--accent-cyan)" strokeWidth={2} fill="url(#projGrad)" dot={false} animationDuration={0} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 16 }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: "50%",
                                border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
                                background: "rgba(0,207,255,0.04)",
                            }}>
                                <span style={{ fontFamily: "'Orbitron'", fontSize: 24, color: "var(--accent-cyan)", opacity: 0.5 }}>◇</span>
                            </div>
                            <div style={{ fontFamily: "'Orbitron'", fontSize: 11, color: "var(--text-secondary)", letterSpacing: 2 }}>PROJECTION IDLE</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 440, textAlign: "center", lineHeight: 1.7 }}>
                                Click <span style={{ color: "var(--accent-cyan)", fontFamily: "'Orbitron'" }}>RUN PROJECTION</span> to simulate 500 charge cycles and predict battery End of Life.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── ROW 3: Peak Migration ── */}
            <div className="card">
                <div className="card-title orange" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Projected dQ/dV Peak Migration Over Aging <InfoButton infoKey="projPeakMigration" /></div>
                <div style={{ width: "100%", height: 220 }}>
                    {peakData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={peakData} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="cycle" stroke="#4a6a8a"
                                    tick={{ fontSize: 10, fill: "#a8c4df", fontFamily: "'Plus Jakarta Sans'" }}
                                    label={{ value: "PROJECTED CYCLE", position: "insideBottom", offset: -18, fill: "#7a9bbf", fontSize: 8, fontFamily: "'Orbitron'", letterSpacing: 2 }} />
                                <YAxis stroke="#4a6a8a"
                                    tick={{ fontSize: 10, fill: "#a8c4df", fontFamily: "'Plus Jakarta Sans'" }}
                                    domain={["dataMin - 0.02", "dataMax + 0.02"]} tickFormatter={v => `${v.toFixed(2)} V`} width={56}
                                    label={{ value: "PEAK V", angle: -90, position: "insideLeft", offset: 8, fill: "#7a9bbf", fontSize: 8, fontFamily: "'Orbitron'", letterSpacing: 2, style: { textAnchor: "middle" } }} />
                                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: 8, fontSize: 11 }}
                                    formatter={(val, name) => [`${val.toFixed(3)} V`, name.toUpperCase()]} labelFormatter={c => `Cycle ${c}`} />
                                <Line type="monotone" dataKey="p1" stroke="#00cfff" strokeWidth={2.5} dot={false} name="Peak 1" />
                                <Line type="monotone" dataKey="p2" stroke="#ff6b2b" strokeWidth={2.5} dot={false} name="Peak 2" />
                                <Line type="monotone" dataKey="p3" stroke="#ffd60a" strokeWidth={2.5} dot={false} name="Peak 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", fontSize: 11 }}>
                            Run a projection to see how dQ/dV peaks migrate with aging.
                        </div>
                    )}
                </div>
            </div>

            {/* ── ROW 4: EOL Summary Cards ── */}
            {eol && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    {[
                        { label: "END-OF-LIFE CYCLE", value: eol.cycle, color: "var(--accent-red)", glow: "rgba(255,45,85,0.3)" },
                        { label: "PROJECTED MONTH", value: `Month ${eol.month}`, color: "var(--accent-orange)", glow: "rgba(255,107,43,0.3)" },
                        { label: "REMAINING USEFUL LIFE", value: `${eol.cycle - cycle} cycles`, color: "var(--accent-green)", glow: "rgba(0,255,136,0.3)" },
                    ].map((item, i) => (
                        <div key={i} className="card" style={{ textAlign: "center", padding: "20px 16px" }}>
                            <div style={{ fontFamily: "'Orbitron'", fontSize: 7, letterSpacing: 2.5, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase" }}>{item.label}</div>
                            <div style={{ fontFamily: "'Orbitron'", fontSize: 32, fontWeight: 900, color: item.color, textShadow: `0 0 20px ${item.glow}`, lineHeight: 1 }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
