# Indra-BMS — Edge-Native Battery Intelligence System

> **VSDSquadron ULTRA · THEJAS32 RISC-V · Physics-Informed · White-Box Analytics**

Indra-BMS is a real-time Battery Management System that runs fully on the edge. It uses **differential capacity analysis (dQ/dV)** with a **Savitzky–Golay filter** to detect lithium plating, SEI growth, and loss of active material — directly on the VSDSquadron ULTRA board, with no cloud dependency.

---

## Hardware Setup

| Component | Interface | Address / Pin |
|---|---|---|
| VSDSquadron ULTRA (THEJAS32) | — | — |
| INA219 — Current + Voltage | I²C | `0x40` |
| ADS1015 — Battery ADC | I²C | `0x48` |
| DS18B20 — Cell Temperature | 1-Wire | `GPIO4` |
| TP4056 — Charger | — | B+ / B− |
| 2× 18650 Li-ion (parallel) | — | 3.7 V nominal |

Full wiring diagram: [`docs/FULL BREADBOARD WIRING SUMMARY.md`](docs/FULL%20BREADBOARD%20WIRING%20SUMMARY.md)

---

## Flashing the Firmware

### Option A — Arduino IDE (GUI)
Follow [`docs/setup-guide.md`](docs/setup-guide.md) to install the VEGA board package and upload via **Sketch → Upload**.

### Option B — `arduino-cli` (No IDE required ✅)

#### One-time setup
```powershell
# 1. Install arduino-cli
winget install arduino.arduino-cli

# 2. Add the VEGA/ARIES board package
arduino-cli config add board_manager.additional_urls `
  https://gitlab.com/riscv-vega/vega-arduino/-/raw/main/package_vega_index.json

# 3. Install the board core
arduino-cli core update-index
arduino-cli core install vega:riscv

# Confirm the exact FQBN available on your machine
arduino-cli board listall vega
```

#### Flash the board
```powershell
# Compile
arduino-cli compile --fqbn vega:riscv:aries_v3 firmware\indra_bms_circuit_test

# Upload (UART/XMODEM mode — BOOT SEL jumper open)
arduino-cli upload --fqbn vega:riscv:aries_v3 --port COM11 --programmer vegaxmodem firmware\indra_bms_circuit_test
```

> **Tip:** Use `arduino-cli board list` to confirm which COM port the board is on.

---

## Running the Dashboard

### Prerequisites
- **Node.js** 18+
- **Chrome or Edge** 89+ (Web Serial API support required)

### Start the dev server
```powershell
npm install   # first time only
npm run dev
```

Open **`http://localhost:5173`** in Chrome or Edge.

---

## Connecting the Board to the Dashboard (Live Telemetry)

The dashboard uses the **Web Serial API** — a direct browser-to-hardware USB connection with no backend server needed.

1. Upload the firmware (see above)
2. **Close Arduino IDE Serial Monitor** if it is open — only one app can hold `COM11` at a time
3. Open `http://localhost:5173` in **Chrome or Edge**
4. Click **"CONNECT BOARD"** in the top-right header
5. Select `COM11` from the browser's port picker → click **Connect**
6. The status indicator switches from `SIM — VSDSquadron ULTRA` to **`HW — VSDSquadron ULTRA`**
7. Pack Voltage, Current, and Cell Temperature are now live from the INA219 and DS18B20

> **Note:** Firefox does not support Web Serial API. Use Chrome or Edge.

---

## Dashboard Features

| Panel | Data Source | Status |
|---|---|---|
| **dQ/dV Analysis** | Simulated (real: requires full charge cycle) | Live |
| **Savitzky–Golay Filter toggle** | Shows Raw (red) vs. Filtered (green) overlay | Live |
| **State of Health** | Degradation model seeded from cycle data | Live |
| **Remaining Useful Life** | Estimated from SoH curve | Live |
| **Pack Voltage** | INA219 Bus Voltage (real when connected) | Live |
| **Current** | INA219 shunt current (real when connected) | Live |
| **Cell Temperature Heatmap** | DS18B20 → Digital Twin (12-cell 3S4P) | Live |
| **Degradation Classifier** | Peak-shift detection (Lithium Plating, LAM, LLI) | Live |
| **Edge-Native Bandwidth** | Bytes sent vs. raw equivalent | Live |

---

## Project Structure

```
EV-BIC/
├── firmware/
│   ├── indra_bms_circuit_test/   # Main sensor test firmware (v0.4)
│   ├── indra_bms_serial_test/    # Serial ping/pong test
│   └── i2c_scanner/              # I²C device scanner
├── src/
│   ├── App.jsx                   # Main dashboard
│   ├── DQDVChart.jsx             # dQ/dV + Savitzky-Golay analysis
│   ├── useSerial.js              # Web Serial API hook
│   ├── App.css                   # Dashboard styles
│   └── main.jsx                  # React entry point
├── docs/
│   ├── FULL BREADBOARD WIRING SUMMARY.md
│   └── setup-guide.md
├── index.html
├── vite.config.js
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Charts | Recharts |
| Fonts | Orbitron, Plus Jakarta Sans |
| Hardware bridge | Web Serial API |
| Firmware | C++ (Arduino / THEJAS32 RISC-V) |
| Signal processing | Savitzky–Golay filter (5-point, order 2) |
