import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── COMPREHENSIVE INFO DEFINITIONS ─────────────────────────
export const INFO = {
    // ═══════════════════════════════════════════════════════════
    //  OVERVIEW PAGE
    // ═══════════════════════════════════════════════════════════
    soh: {
        title: "State of Health (SoH)",
        body: "State of Health quantifies a battery's current maximum capacity relative to its rated (new) capacity. It is the single most important metric for determining whether a battery pack is fit for continued use.\n\nA new battery starts at 100% SoH. As the cell undergoes charge-discharge cycles, irreversible chemical processes — SEI growth, lithium plating, and active material dissolution — gradually consume usable lithium and electrode surface area, reducing the total energy the cell can store.\n\nIn the EV industry, 80% SoH is the standard End-of-Life threshold (IEC 62660-1), below which the battery is considered unfit for automotive use (though it may still serve in stationary storage).",
        formula: "SoH = (C_current / C_rated) × 100%\nC_rated = manufacturer's nameplate capacity (e.g. 2.2 Ah)",
    },
    packVoltage: {
        title: "Pack Voltage",
        body: "The terminal voltage measured across the battery pack's positive and negative terminals. For a single-cell system like this test bench, pack voltage equals cell voltage.\n\nVoltage varies with State of Charge (SoC), current direction, temperature, and age. During discharge, voltage drops below the Open Circuit Voltage (OCV) due to internal resistance (IR drop). During charge, it rises above OCV.\n\nThe INA219 current/voltage sensor on our RISC-V board measures bus voltage at 1 Hz with 12-bit resolution, providing ±0.5% accuracy across the 0–26 V range.",
        formula: "V_terminal = V_OCV − I × R_internal\nR_internal ↑ as cell ages → voltage sag increases",
    },
    testMode: {
        title: "Test Mode — Constant Current",
        body: "The battery is being tested under a Constant Current (CC) protocol, where a fixed current magnitude is applied throughout the charge or discharge phase.\n\nIn our setup:\n• Charge: 1.5 A CC until 4.2 V, then CV taper until I < 20 mA\n• Discharge: 2.0 A CC until cutoff at 2.7 V\n\nConstant Current testing provides repeatable, comparable results across cycles because the electrical stress is controlled. It is the standard protocol for accelerated aging studies (NASA PCoE, CALCE, Oxford Battery Degradation).",
    },
    peakPosError: {
        title: "Peak Position Error",
        body: "This metric measures the deviation between the detected dQ/dV peak voltage positions and their expected reference values. A low error (< 50 mV) confirms that the Savitzky-Golay smoothing and peak detection algorithm is accurately identifying the electrochemical transition peaks.\n\nThese peaks correspond to specific lithium intercalation stages in the graphite anode and transition metal oxide cathode. Their positions shift systematically with degradation:\n• LLI (Loss of Lithium Inventory) → peaks shift right\n• LAM-NE (Negative Electrode Loss) → peaks shift left\n• LAM-PE (Positive Electrode Loss) → peak heights decrease",
        formula: "Error = |V_detected − V_reference|\nV_reference values: P1 ≈ 3.45 V, P2 ≈ 3.72 V, P3 ≈ 4.05 V",
    },
    thermalNorm: {
        title: "Arrhenius Thermal Normalization",
        body: "Battery degradation rates are strongly temperature-dependent, following the Arrhenius equation. To compare measurements taken at different temperatures fairly, all capacity values are normalized to a reference temperature of 25°C.\n\nThis correction accounts for the fact that higher temperatures temporarily boost apparent capacity (due to faster ion diffusion) while also accelerating permanent degradation. Without normalization, a cell tested at 35°C would appear healthier than the same cell tested at 15°C, even if the underlying degradation is identical.",
        formula: "k(T) = A × exp(−Eₐ / R × T)\nEₐ ≈ 20–80 kJ/mol for Li-ion\nR = 8.314 J/(mol·K)\nT in Kelvin",
    },
    dqdvChart: {
        title: "Differential Capacity Analysis (dQ/dV)",
        body: "The dQ/dV curve is the derivative of charge (Q) with respect to voltage (V). It transforms the gently sloping voltage-capacity curve into a series of sharp peaks, each corresponding to a specific electrochemical phase transition inside the cell.\n\nFor a graphite||NMC lithium-ion cell, three primary peaks appear:\n• P1 (~3.45 V): Stage II→I graphite lithiation\n• P2 (~3.72 V): NMC solid-solution reaction\n• P3 (~4.05 V): High-voltage NMC transition\n\nAs the battery degrades, these peaks shift, shrink, or broaden — each pattern indicating a specific degradation mechanism (LLI, LAM-PE, or LAM-NE). This makes dQ/dV analysis the gold standard for non-destructive degradation diagnostics.",
        formula: "dQ/dV = ΔQ / ΔV = (I × Δt) / ΔV\nSmoothed with Savitzky-Golay (window=7, order=3)",
    },
    rul: {
        title: "Remaining Useful Life (RUL)",
        body: "RUL estimates how many additional charge-discharge cycles the battery can sustain before reaching the End-of-Life threshold (typically 80% SoH for EV applications, 70% for this NASA dataset).\n\nIndra-BMS calculates RUL using a physics-informed model that considers:\n• Current capacity fade rate (linear regression over recent cycles)\n• Nonlinear acceleration factor (knee-point detection)\n• Temperature history (Arrhenius correction)\n\nUnlike pure machine-learning approaches, this white-box model provides explainable predictions — you can see why the RUL estimate changed, not just that it changed.",
        formula: "RUL ≈ (SoH_current − SoH_threshold) / FadeRate\nFadeRate = ΔSoH / ΔCycles (moving average)",
    },
    liveTelemetry: {
        title: "Live Telemetry Panel",
        body: "This panel displays real-time sensor readings from the battery test bench. When the RISC-V hardware (VSDSquadron ULTRA) is connected via USB-UART:\n\n• Voltage: INA219 bus voltage (12-bit, ±0.5%)\n• Current: INA219 shunt current (±400 mA range)\n• Temperature: DS18B20 digital sensor (±0.5°C accuracy)\n• Cycle count: Cumulative tracking\n\nWhen hardware is disconnected, the dashboard falls back to a NASA-validated simulation that interpolates between real degradation data points, ensuring physically plausible values at all times.",
    },
    bandwidthSavings: {
        title: "Edge-Native Bandwidth Savings",
        body: "Traditional cloud-connected BMS streams ALL raw sensor data to a remote server — voltage, current, temperature, IMU readings — generating approximately 5 MB/hour per vehicle.\n\nIndra-BMS performs all analytics on the edge (RISC-V microcontroller), sending only 50-byte health summaries per cycle. This achieves a 99.95% data reduction.\n\nFor a fleet of 10,000 EVs, this translates to saving ~42 TB of cloud data ingress per year, worth approximately ₹3.5 lakh ($4,200 USD) in cloud storage costs alone — before accounting for compute and network charges.",
        formula: "Cloud: 5 MB/hr × 24 hr × 365 days = ~43 GB/vehicle/year\nEdge: 50 bytes/cycle × ~365 cycles = ~18 KB/vehicle/year\nReduction = 99.95%",
    },
    degradationClassifier: {
        title: "Degradation Mode Classifier",
        body: "This classifier identifies the dominant mechanism causing battery aging by analyzing the dQ/dV peak signature. Three modes are tracked:\n\n• LLI (Loss of Lithium Inventory): The most common mode. Lithium ions become permanently trapped in the SEI layer during each cycle, reducing the total charge carrier population. Signature: all peaks shift to higher voltages.\n\n• LAM-PE (Positive Electrode Loss): Transition metal dissolution from the cathode. Cobalt, nickel, or manganese ions dissolve into the electrolyte and deposit on the anode. Signature: peak heights decrease without position shift.\n\n• LAM-NE (Negative Electrode Loss): Graphite particle cracking from repeated lithium intercalation/deintercalation. Signature: peaks shift to lower voltages with reduced heights.",
    },
    thermalMonitor: {
        title: "Cell Thermal Monitor",
        body: "Monitors the real-time cell surface temperature using a DS18B20 digital temperature sensor connected to the RISC-V board. Temperature is the single most critical safety parameter for lithium-ion batteries.\n\nTemperature zones:\n• PASS (< 35°C): Normal operating range, minimal thermal stress\n• WARN (35–45°C): Elevated temperature, accelerated SEI growth\n• HOT (> 45°C): Critical zone, risk of thermal runaway\n\nEach 10°C increase approximately doubles the degradation rate (Arrhenius). Maintaining cells below 35°C during cycling is essential for maximizing calendar and cycle life.",
        formula: "Degradation rate ∝ exp(−Eₐ / kT)\n+10°C ≈ 2× faster aging\nThermal runaway onset: typically > 130°C for NMC cells",
    },
    cycleHistory: {
        title: "Charge Cycle History — SoH Trend",
        body: "This area chart plots the State of Health percentage against charge cycle number over the most recent 30 cycles. The downward trend reveals the battery's real-time degradation trajectory.\n\nColor coding indicates health zones:\n• Green (cycles 1–20): Healthy range, gradual linear fade\n• Yellow (cycles 21–26): Accelerating degradation, approaching knee point\n• Orange (cycles 27+): Rapid nonlinear fade, possible capacity knee\n\nThe 'knee point' is a critical phenomenon where degradation suddenly accelerates due to feedback loops between LLI, LAM, and thermal effects. Detecting this inflection early is one of Indra-BMS's key predictive capabilities.",
    },

    // ═══════════════════════════════════════════════════════════
    //  DEEP-DIVE ANALYTICS PAGE
    // ═══════════════════════════════════════════════════════════
    degradationBreakdown: {
        title: "Degradation Mode Breakdown",
        body: "This donut chart quantifies the relative contribution of each degradation mechanism to the total capacity fade observed so far.\n\nThe white-box physics model decomposes total fade into three root causes:\n\n• LLI (Loss of Lithium Inventory) — typically 55–70% of total fade. Caused by parasitic reactions at the SEI layer that irreversibly consume cyclable lithium during each charge cycle.\n\n• LAM-PE (Positive Electrode Loss) — typically 15–25%. Caused by transition metal dissolution from the NMC cathode at high voltages and temperatures.\n\n• LAM-NE (Negative Electrode Loss) — typically 10–20%. Caused by mechanical fracture of graphite particles from repeated intercalation stress.\n\nThis breakdown is the core differentiator of Indra-BMS: most BMS systems only report THAT the battery is degrading, not WHY.",
    },
    peakShiftAnalysis: {
        title: "Peak Voltage Shift Analysis",
        body: "This bar chart shows how far each dQ/dV peak has shifted from its original position (in millivolts). The magnitude and direction of shift directly diagnoses the active degradation mechanism.\n\n• P1 (3.45 V) — Graphite Stage II→I: Most sensitive to LLI. A rightward shift of 10+ mV indicates significant lithium loss.\n\n• P2 (3.72 V) — NMC solid-solution: Moderate sensitivity. Shifts correlate with combined LLI + LAM-PE.\n\n• P3 (4.05 V) — High-voltage NMC: Most sensitive to cathode degradation. Shifts here indicate LAM-PE (positive electrode loss).\n\nLarger shifts = more degradation. The pattern of which peaks shift most reveals the dominant mechanism.",
        formula: "Shift = V_current − V_baseline (mV)\nLLI dominant: P1 shift > P2 > P3\nLAM-PE dominant: P3 shift ≈ P2 > P1",
    },
    roiCalculator: {
        title: "Edge vs. Cloud — Fleet ROI Calculator",
        body: "This interactive calculator demonstrates the cost savings of edge-native BMS analytics versus traditional cloud-dependent architectures.\n\nTraditional BMS approach:\n• Streams 5 MB/hour of raw sensor data per vehicle\n• Requires cloud compute for all analytics\n• Cost scales linearly with fleet size\n\nIndra-BMS edge approach:\n• Processes all data on-device (RISC-V at 50 MHz)\n• Sends only 50-byte health summaries\n• 99.95% data reduction\n\nAdjust the fleet size and cloud cost sliders to see real-time savings projections in both INR and USD. The model accounts for standard AWS S3 + Lambda pricing tiers.",
    },

    // ═══════════════════════════════════════════════════════════
    //  DIGITAL TWIN (PROJECTION) PAGE
    // ═══════════════════════════════════════════════════════════
    projSoh: {
        title: "Projected State of Health",
        body: "This chart shows a Monte Carlo-style forward projection of how SoH will decline over the next 500 charge cycles, starting from the current measured state.\n\nThe projection model accounts for:\n• Linear capacity fade (base degradation rate)\n• Nonlinear acceleration below 80% SoH (knee-point effect)\n• Stochastic variation (random capacity fluctuations)\n• Temperature-corrected fade rates\n\nThe 80% EOL threshold is marked with a red dashed line. When the projected curve crosses this line, the system reports the estimated End-of-Life cycle number and calendar month.",
        formula: "SoH(n+1) = SoH(n) − FadeRate(n) − ε\nFadeRate = 0.04 + 0.0001n + acceleration_terms\nε = random noise ~ U(0, 0.01)",
    },
    projPeakMigration: {
        title: "Projected dQ/dV Peak Migration",
        body: "This chart projects how the three main dQ/dV peak voltages will shift over 500 future cycles. As degradation progresses, peaks migrate to higher voltages (indicating LLI) or change in height (indicating active material loss).\n\nThe three tracked peaks:\n• P1 (cyan, ~3.45 V): Graphite Stage II→I — most sensitive to lithium inventory changes\n• P2 (orange, ~3.72 V): NMC bulk reaction — responds to combined degradation\n• P3 (yellow, ~4.05 V): High-voltage NMC — indicates cathode health\n\nConverging peaks suggest accelerating degradation. Diverging peaks may indicate that different degradation mechanisms are progressing at different rates.",
        formula: "P1_shift = fade × 0.003 V per % fade\nP2_shift = fade × 0.002 V per % fade\nP3_shift = fade × 0.001 V per % fade",
    },
    projEolCycle: {
        title: "End-of-Life Cycle Prediction",
        body: "The projected cycle number at which SoH will drop below the 80% threshold. This is the battery's predicted remaining calendar life, assuming the current usage pattern continues.\n\nFactors that can change this prediction:\n• Increasing ambient temperature → accelerates fade → EoL sooner\n• Reducing charge rate → slows fade → EoL later\n• Avoiding deep discharge (< 2.7 V) → reduces LAM-NE\n• Operating in 20–30°C range → minimizes Arrhenius acceleration\n\nThis prediction updates automatically whenever a new projection is run with updated input parameters.",
    },
    projRul: {
        title: "Remaining Useful Life (Projected)",
        body: "The difference between the predicted End-of-Life cycle and the current cycle count. This represents how many more charge-discharge cycles the battery can undergo before it needs to be replaced or repurposed.\n\nFor EV applications, this metric directly translates to remaining driving range:\n• If RUL = 200 cycles and each cycle provides 300 km range\n• Total remaining service life ≈ 60,000 km\n\nFor second-life applications (stationary storage), batteries can often continue operating down to 60% SoH, significantly extending their useful life beyond the EV threshold.",
    },

    // ═══════════════════════════════════════════════════════════
    //  NASA DATA EXPLORER (already defined — re-export)
    // ═══════════════════════════════════════════════════════════
    totalCycles: {
        title: "Total Charge-Discharge Cycles",
        body: "A cycle is one complete charge followed by one complete discharge of the battery cell. The NASA Ames experiment ran battery B0005 through repeated CC-CV charge (1.5A to 4.2V) and CC discharge (2A to 2.7V cutoff) cycles at room temperature until the cell reached its End-of-Life threshold. The total cycle count indicates how many full operations the cell survived before capacity dropped below 70% of its rated value.",
        formula: "N_total = count of {charge → discharge} pairs before EoL",
    },
    initialCapacity: {
        title: "Initial Rated Capacity",
        body: "The maximum amount of electric charge a fully charged battery can deliver under specified conditions, measured in Ampere-hours (Ah). For cell B0005, this was measured at the very first cycle before any degradation had occurred. This serves as the 100% baseline for all subsequent State-of-Health calculations.",
        formula: "C₀ = ∫₀ᵗ I(t) dt  during first full discharge",
    },
    finalCapacity: {
        title: "Final Measured Capacity",
        body: "The capacity measured at the battery's last tested cycle. This value reflects cumulative degradation from SEI (Solid Electrolyte Interphase) layer growth, loss of lithium inventory (LLI), and loss of active material (LAM). The ratio of final-to-initial capacity directly gives the End-of-Life State of Health.",
        formula: "C_final = ∫₀ᵗ I(t) dt  at last cycle",
    },
    eolSoh: {
        title: "End-of-Life State of Health",
        body: "State of Health (SoH) expresses the battery's current capacity as a percentage of its original rated capacity. An SoH of 80% is a common end-of-life threshold in the EV industry (per IEC 62660-1). In this NASA experiment, the cell was cycled until capacity fade was significant enough to observe all major degradation modes — LLI, LAM-PE, and LAM-NE.",
        formula: "SoH = (C_current / C_rated) × 100%",
    },
    capacityDegradation: {
        title: "Capacity Degradation Curve",
        body: "This chart plots the measured discharge capacity (Ah) against charge-discharge cycle number. The downward trend shows irreversible capacity fade caused by three primary degradation mechanisms:\n\n• Loss of Lithium Inventory (LLI) — lithium ions become permanently trapped in the SEI layer.\n• Loss of Active Material at Negative Electrode (LAM-NE) — graphite particles crack and disconnect.\n• Loss of Active Material at Positive Electrode (LAM-PE) — transition metal dissolution from the cathode.\n\nThe dashed red line marks the 70% EoL threshold (1.54 Ah for this 2.2 Ah cell).",
        formula: "Fade Rate ≈ ΔC / ΔN  (Ah per cycle)",
    },
    peakThermal: {
        title: "Peak Thermal Drift",
        body: "As a lithium-ion cell degrades, its internal resistance (R_int) increases due to SEI thickening and contact loss. Higher internal resistance means more ohmic heating (I²R losses) during charge and discharge. This chart tracks the maximum temperature recorded during each cycle, showing a clear upward trend as the cell ages. Excessive thermal rise accelerates degradation through an Arrhenius-type relationship, creating a positive feedback loop.",
        formula: "Q_heat = I² × R_int   |   R_int ↑ as SEI grows   |   k = A·exp(−Eₐ/RT)",
    },
    coulombicEfficiency: {
        title: "Coulombic Efficiency Trend",
        body: "Coulombic Efficiency (CE) is the ratio of charge extracted during discharge to charge inserted during the previous charge cycle. A CE of 100% would mean zero parasitic reactions. In practice, side reactions at the SEI layer consume small amounts of lithium each cycle, causing CE to be slightly below 100%. As the cell degrades, more lithium is lost per cycle, so CE trends downward. Even a 0.1% drop in CE compounds over hundreds of cycles into significant capacity loss.",
        formula: "η_C = (Q_discharge / Q_charge) × 100%",
    },
    chargeDischargeTime: {
        title: "Charge & Discharge Duration",
        body: "This chart shows the time (in seconds) required to fully charge and fully discharge the cell at each measured cycle. As capacity fades, both durations decrease because there is simply less energy to store and deliver. The charge time decreases more gradually because the CC-CV protocol's constant-voltage tail shortens as the cell's capacity drops. The discharge time drops more linearly since it's a constant-current process limited purely by remaining capacity.",
        formula: "t_discharge ≈ C / I_discharge   |   t_charge ≈ C / I_charge + t_CV_tail",
    },
    chargeProfile: {
        title: "CC-CV Charge Protocol",
        body: "Constant Current – Constant Voltage (CC-CV) is the standard lithium-ion charging protocol. The charger first applies a constant current (1.5A in this experiment) until the cell voltage reaches the upper cutoff (4.2V). Then it switches to constant voltage mode, holding 4.2V while the current tapers exponentially. Charging is terminated when the current drops below 20mA. This two-phase approach maximizes capacity while preventing lithium plating at the negative electrode.",
        formula: "Phase 1: I = 1.5A (constant), V rises → 4.2V\nPhase 2: V = 4.2V (constant), I decays → 20mA cutoff",
    },
    dischargeProfile: {
        title: "CC Discharge Protocol",
        body: "Constant Current (CC) discharge applies a fixed current drain (2A in this experiment) until the cell voltage drops to the lower cutoff (2.7V). This controlled discharge ensures consistent, repeatable capacity measurements across every cycle. The 2A rate represents approximately a 1C discharge rate for this 2.2Ah cell, which is a moderate stress level that balances test speed with realistic operating conditions.",
        formula: "I = 2.0A (constant) until V_cell ≤ 2.7V",
    },
    simulationBridge: {
        title: "Hybrid Simulation Bridge",
        body: "When the RISC-V hardware (VSDSquadron ULTRA) is not connected via UART, the Indra-BMS dashboard falls back to this NASA B0005 dataset to drive the simulation. Instead of generating random noise, the dashboard interpolates between real NASA degradation data points, producing physically plausible voltage, temperature, and SoH values. This ensures the simulated telemetry never shows flatline or unrealistic readings, maintaining credibility during demonstrations.",
    },
    dataset: {
        title: "NASA Ames Prognostics Center of Excellence",
        body: "This data originates from the NASA Prognostics Center of Excellence (PCoE) battery dataset, specifically cell B0005. The experiment was conducted at NASA Ames Research Center to study degradation patterns in commercial 18650 lithium-ion cells under controlled cycling conditions. The dataset is widely used as a benchmark in prognostics and health management (PHM) research for validating Remaining Useful Life (RUL) prediction algorithms.",
    },
    rawDataTable: {
        title: "Per-Cycle Summary Metrics",
        body: "This table shows the raw measurement data exported from the NASA experiment at sampled cycle intervals. Each row represents one measured cycle with:\n\n• Capacity (Ah): Discharge capacity measured by coulomb counting\n• SoH (%): State of Health relative to initial capacity\n• Peak Temp (°C): Maximum cell surface temperature during the cycle\n• Efficiency (%): Coulombic efficiency (discharge charge / charge charge)\n• Charge Time (s): Total time for the CC-CV charge phase\n• Discharge Time (s): Total time for CC discharge to cutoff",
    },
    avgEfficiency: {
        title: "Average Coulombic Efficiency",
        body: "The mean Coulombic Efficiency across all measured cycles in the dataset. This aggregate metric indicates the overall parasitic reaction rate throughout the cell's lifecycle. A value close to 100% means minimal side reactions, while lower values indicate significant lithium consumption by the SEI layer and other parasitic processes.",
        formula: "η_avg = (1/N) × Σ (Q_discharge_i / Q_charge_i) × 100%",
    },
};

// ─── INFO BUTTON COMPONENT ──────────────────────────────────
export default function InfoButton({ infoKey }) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, right: undefined, maxH: 400 });
    const popupRef = useRef(null);
    const btnRef = useRef(null);

    const info = INFO[infoKey];
    if (!info) return null;

    const close = useCallback(() => setOpen(false), []);

    // Close on ESC
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, close]);

    // Close on click outside (handling portal)
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target) &&
                btnRef.current && !btnRef.current.contains(e.target)) {
                close();
            }
        };
        setTimeout(() => window.addEventListener("mousedown", handler), 0);
        return () => window.removeEventListener("mousedown", handler);
    }, [open, close]);

    // Calculate page-absolute coords so popup scrolls with content
    const handleToggle = (e) => {
        e.stopPropagation();
        if (!open) {
            const rect = btnRef.current.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const POPUP_W = 380;
            const POPUP_H = 420; // approximate max popup height
            const GAP = 8;
            const EDGE = 12; // min margin from viewport edges

            // ── Horizontal: left-align, clamp if near right edge ──
            let leftPos = rect.left + scrollX;
            if (rect.left + POPUP_W > vw - EDGE) {
                leftPos = rect.left + scrollX + rect.width - POPUP_W;
                if (leftPos < scrollX + EDGE) leftPos = scrollX + EDGE;
            }

            // ── Vertical: prefer below, flip above if popup won't fit ──
            const spaceBelow = vh - rect.bottom - GAP;
            const spaceAbove = rect.top - GAP;
            let topPos, maxH;

            if (spaceBelow >= POPUP_H) {
                // Plenty of room below — open downward
                topPos = rect.bottom + scrollY + GAP;
                maxH = POPUP_H;
            } else if (spaceAbove >= POPUP_H) {
                // Plenty of room above — open upward
                maxH = POPUP_H;
                topPos = rect.top + scrollY - GAP - maxH;
            } else if (spaceAbove > spaceBelow) {
                // More room above, but not full height — constrain
                maxH = Math.max(150, spaceAbove - EDGE);
                topPos = rect.top + scrollY - GAP - maxH;
            } else {
                // More room below, but not full height — constrain
                maxH = Math.max(150, spaceBelow - EDGE);
                topPos = rect.bottom + scrollY + GAP;
            }

            setCoords({ top: topPos, left: leftPos, maxH });
            setOpen(true);
        } else {
            setOpen(false);
        }
    };

    return (
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <button
                ref={btnRef}
                onClick={handleToggle}
                aria-label={open ? "Close info" : `Info: ${info.title}`}
                style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: open ? "rgba(255,45,85,0.2)" : "rgba(0,207,255,0.08)",
                    border: `1px solid ${open ? "rgba(255,45,85,0.5)" : "rgba(0,207,255,0.25)"}`,
                    color: open ? "var(--accent-red)" : "var(--accent-cyan)",
                    cursor: "pointer",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: open ? 10 : 11,
                    fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease", lineHeight: 1, padding: 0,
                    flexShrink: 0, textTransform: "none",
                }}
                onMouseEnter={(e) => {
                    if (!open) e.currentTarget.style.background = "rgba(0,207,255,0.15)";
                }}
                onMouseLeave={(e) => {
                    if (!open) e.currentTarget.style.background = "rgba(0,207,255,0.08)";
                }}
            >
                {open ? "✕" : "i"}
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", zIndex: 99999 }}>
                    <div
                        onClick={close}
                        style={{ position: "fixed", inset: 0, zIndex: 99998 }}
                    />
                    <div
                        ref={popupRef}
                        style={{
                            position: "absolute",
                            top: coords.top,
                            left: coords.left != null ? coords.left : undefined,
                            width: 380, maxWidth: "calc(100vw - 24px)",
                            maxHeight: coords.maxH || 400,
                            overflowY: "auto",
                            zIndex: 99999,
                            background: "rgba(10, 16, 30, 0.98)",
                            border: "1px solid rgba(0,207,255,0.3)",
                            borderRadius: 8,
                            padding: "16px 20px",
                            boxShadow: "0 16px 64px rgba(0,0,0,0.8), 0 0 40px rgba(0,207,255,0.08)",
                            backdropFilter: "blur(20px)",
                            animation: "popIn 0.2s ease-out",
                            textTransform: "none",
                            letterSpacing: "normal",
                        }}
                    >
                        <div style={{
                            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                            fontSize: 14, fontWeight: 600,
                            color: "var(--accent-cyan)",
                            marginBottom: 8, lineHeight: 1.35,
                            letterSpacing: 0.1, textTransform: "none",
                        }}>{info.title}</div>

                        <div style={{
                            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                            fontSize: 13, lineHeight: 1.6,
                            color: "rgba(232, 244, 253, 0.9)",
                            whiteSpace: "pre-line",
                            textTransform: "none", letterSpacing: 0,
                        }}>{info.body}</div>

                        {info.formula && (
                            <div style={{
                                marginTop: 12, padding: "8px 12px",
                                background: "rgba(0,207,255,0.04)",
                                border: "1px solid rgba(0,207,255,0.15)",
                                borderRadius: 6,
                                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                                fontSize: 11, color: "var(--accent-cyan)", lineHeight: 1.5,
                                whiteSpace: "pre-line", letterSpacing: 0.2,
                                textTransform: "none",
                            }}>{info.formula}</div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </span>
    );
}
