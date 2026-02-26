# Indra-BMS — VSD Squadron ULTRA Setup Guide

## Hardware Overview

| Spec              | Value                                             |
| ----------------- | ------------------------------------------------- |
| **Board**         | VSD Squadron ULTRA                                |
| **SoC**           | THEJAS32 (C-DAC VEGA ET1031, RV32IM, 100 MHz)    |
| **USB Interface** | CP2102N USB-UART                                  |
| **COM Port**      | COM11 (your current connection)                   |
| **Memory**        | 256KB SRAM, 2MB SPI Flash                         |
| **Communication** | 4×SPI, 3×I²C, 3×UART, 4-ch 12-bit ADC            |
| **Boot Modes**    | UART (XMODEM) / QSPI Flash (via BOOT SEL jumper)  |



## Step 1 — Install Arduino IDE

- Download **Arduino IDE 2.x** (2.3.x or later recommended) from [arduino.cc](https://www.arduino.cc/en/software)
- Install and launch



## Step 2 — Add Board Manager URL

1. Open Arduino IDE
2. Go to **File → Preferences** (or `Ctrl+,`)
3. In **"Additional Boards Manager URLs"**, paste:

```
https://gitlab.com/riscv-vega/vega-arduino/-/raw/main/package_vega_index.json
```

> If you already have other URLs, separate them with commas.

4. Click **OK**



## Step 3 — Install VEGA ARIES Board Package

1. Go to **Tools → Board → Boards Manager...**
2. Search for **"VEGA"** or **"ARIES"**
3. Install **"VEGA ARIES Boards"** by C-DAC
4. Wait for installation to complete



## Step 4 — Install CP2102N USB Driver (if needed)

If COM11 does not appear:

1. Download Silicon Labs CP210x drivers from:
   [silabs.com/developers/usb-to-uart-bridge-vcp-drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
2. Install the driver
3. Reconnect the board via USB-C
4. Verify in **Device Manager → Ports (COM & LPT)** that `COM11` appears



## Step 5 — Configure Arduino IDE (CRITICAL)

### Board Selection
> **The board appears as "ARIES v3" in the menu, NOT "VSDSquadron ULTRA"**

1. **Board:** `Tools → Board → VEGA Processor: ARIES Boards → ARIES v3`
2. **Port:** `Tools → Port → COM11`

### Programmer Settings (depends on BOOT SEL jumper)

#### Option A — UART/XMODEM Mode (recommended for development)
> Use this when BOOT SEL jumper J12 is **NOT shorted** (open)

| Setting        | Value           |
| -------------- | --------------- |
| Flash Mode     | `Disabled`      |
| Programmer     | `VEGA XMODEM`   |
| Upload method  | Normal Upload   |

#### Option B — QSPI Flash Mode
> Use this when BOOT SEL jumper J12 is **shorted**

| Setting        | Value           |
| -------------- | --------------- |
| Flash Mode     | `Enabled`       |
| Programmer     | `VEGA FLASHER`  |
| Upload method  | **Upload Using Programmer** (`Sketch → Upload Using Programmer`) |



## Step 6 — Upload & Verify

1. Open the sketch: `firmware/indra_bms_serial_test/indra_bms_serial_test.ino`
2. **If using XMODEM:** Click **Upload** (→ button) or `Ctrl+U`
3. **If using FLASHER:** Use **Sketch → Upload Using Programmer** (`Ctrl+Shift+U`)
4. Open **Serial Monitor** (`Ctrl+Shift+M`)
5. Set baud rate to **115200**
6. Set line ending to **Newline** (NL)
7. Type `ping` and hit Enter → should see `pong`



## Troubleshooting

| Issue                                    | Fix                                                            |
| ---------------------------------------- | -------------------------------------------------------------- |
| `board not found` error                  | Select **ARIES v3** (not VSDSquadron ULTRA) from board menu    |
| COM11 not showing                        | Install CP2102N driver, try different USB-C cable              |
| Upload fails                             | Check BOOT SEL jumper, match Flash Mode + Programmer settings  |
| No serial output                         | Verify baud rate is 115200, check correct COM port selected    |
| Board not in menu                        | Re-add board manager URL, restart Arduino IDE                  |
| "Access denied" on port                  | Close any other serial monitor / program using COM11           |
| Upload stuck / no response               | Press RESET button on board, then immediately click Upload     |
