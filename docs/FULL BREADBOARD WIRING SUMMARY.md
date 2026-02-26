# Indra-BMS — Full Breadboard Wiring Summary (v0.4 — DS18B20 only)

> LM35 removed. DS18B20 is the sole temperature sensor.

---

## Components Used

| Component | Role | Interface |
|---|---|---|
| VSDSquadron ULTRA | Main controller (THEJAS32 RISC-V) | — |
| INA219 module | Battery current + voltage monitor | I2C @ 0x40 |
| ADS1015 (on-board) | Battery voltage ADC (AIN0 only) | I2C @ 0x48 |
| DS18B20 | Cell temperature sensor | 1-Wire @ GPIO4 |
| TP4056 | Battery charger (B+ / B- only) | — |
| 2× 18650 Li-ion | Battery pack (parallel = 3.7V) | — |
| R1, R2 (10kΩ each) | Battery voltage divider for AIN0 | — |
| 4.7kΩ | DS18B20 1-Wire pull-up | — |

---

## Power Rails

| Wire | From | To |
|---|---|---|
| 3.3V | Board **3.3V** | Breadboard **+ rail** |
| GND  | Board **GND** | Breadboard **− rail** |

---

## INA219 (I2C @ 0x40)

Wired **in series** with the charging path to measure current.

```
TP4056 B+  ──→  INA219 VIN+  ──→  INA219 VIN-  ──→  Battery B+
Battery B-  ──→  GND
```

| Wire | From | To |
|---|---|---|
| INA219 VCC | + rail | INA219 VCC |
| INA219 GND | − rail | INA219 GND |
| INA219 SDA | Board **SDA** | INA219 SDA |
| INA219 SCL | Board **SCL** | INA219 SCL |
| INA219 VIN+ | **TP4056 B+** | INA219 VIN+ |
| INA219 VIN- | INA219 VIN- | **Battery B+ terminal** |

---

## Battery Voltage Divider → ADS1015 AIN0

Scales battery voltage (max 4.2V) to safe ADC input range (≤ 2.1V).

```
Battery B+  ──[R1 10kΩ]──┬──→  ADS1015 AIN0
                          │
                       [R2 10kΩ]
                          │
                         GND
```

| Component | From | To |
|---|---|---|
| R1 (10kΩ) | Battery B+ terminal | Junction node (breadboard row) |
| R2 (10kΩ) | Junction node | − rail (GND) |
| Wire | Junction node | **ADS1015 AIN0** header pin |

---

## DS18B20 Temperature Sensor (1-Wire @ GPIO4)

Hold flat face toward you: **LEFT = GND, MIDDLE = DATA, RIGHT = VDD**

```
3.3V ──[4.7kΩ]──┬── DS18B20 DATA (Pin 2)
                 └── Board GPIO4
```

| Wire | From | To |
|---|---|---|
| DS18B20 VDD | + rail | DS18B20 Pin 3 (rightmost) |
| DS18B20 GND | − rail | DS18B20 Pin 1 (leftmost) |
| DS18B20 DATA | Board **GPIO4** | DS18B20 Pin 2 (middle) |
| 4.7kΩ pull-up | + rail | DS18B20 DATA row |

---

## TP4056

| Wire | From | To |
|---|---|---|
| B+ | TP4056 B+ | → INA219 VIN+ (see above) |
| B- | Battery B- | − rail / Battery negative |

---

## I2C Bus Summary

Both devices share `SDA` and `SCL`:

| Device | Address | Notes |
|---|---|---|
| INA219 | **0x40** | External module, powered from 3.3V |
| ADS1015 | **0x48** | On-board, no separate wiring needed |

> Do **not** add external I2C pull-up resistors — the board already has them on-PCB.

---

## Pre-Power Checklist

| Check | Expected |
|---|---|
| Continuity: GND rail → Board GND | Beep |
| Continuity: + rail → Board 3.3V | Beep |
| Continuity: SDA/SCL to GND | **No beep** (no short) |
| Continuity: DS18B20 DATA to GND | **No beep** |
| Voltage: Junction node (battery connected) | ~1.4 – 2.1V |
| Resistance: R1+R2 across B+ to GND | ~20kΩ |
| INA219 VIN+ to VIN- | ~0Ω (shunt — correct) |

---

## Expected Serial Output (v0.4)

```
==============================
  Indra-BMS Circuit Test v0.4
  VSDSquadron ULTRA (THEJAS32)
==============================
  Sensors: INA219 | ADS1015 (AIN0)
           DS18B20
==============================

--- I2C Scan ---
[OK]  INA219 @ 0x40
[OK]  ADS1015 @ 0x48
[OK]  DS18B20 on GPIO4
----------------

==============================
  Indra-BMS Readings
==============================
[INA219] Voltage + Current
  Bus Voltage: 3.72 V
  Current    : 452.00 mA
  Power      : 1680.00 mW
  [PASS]

[ADS1015] Battery Voltage (AIN0)
  Batt V (x2): 3.72 V
  [PASS] Divider OK

[DS18B20] Cell Temperature
  Cell Temp  : 26.31 C
  [PASS]
==============================
```
