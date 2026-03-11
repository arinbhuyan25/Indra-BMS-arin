/*
 * ============================================================
 *  Indra-BMS — Full Measurement Firmware v0.5.0
 *  Board   : VSD Squadron ULTRA (THEJAS32 / RISC-V RV32IM)
 *  Circuit : v0.5 — Relay + Power Resistor Load
 * ============================================================
 *
 *  NO EXTERNAL LIBRARIES — driven via THEJAS32 IIC registers.
 *
 *  HARDWARE:
 *    INA219   -> I2C0 (SDA/SCL) addr 0x40  Battery V + I
 *    ADS1015  -> I2C0 (SDA/SCL) addr 0x48  On-board ADC
 *      AIN0   -> Battery voltage divider (R1=R2=10kOhm -> V/2)
 *    DS18B20  -> GPIO4, 1-Wire, 4.7kOhm pull-up to 3.3V
 *    Relay    -> IO5  (active-LOW module, JQC3F-05VDC-C)
 *    Power Resistor (5-10 Ohm, >=5W) on Relay COM -> GND
 *
 *  WIRING (v0.5 topology):
 *    Battery B+ -> INA219 VIN+ -> INA219 VIN- -> Relay COM
 *    Relay COM  -> TP4056 B+ (charger)
 *    Relay NO   -> Power Resistor -> GND (load when relay ON)
 *    Battery B+ -> R1(10k) -> Junction -> R2(10k) -> GND
 *    Junction   -> ADS1015 AIN0
 *    Battery B- -> GND rail
 *
 *  SERIAL: 115200 baud, JSON output at 1 Hz.
 *    Commands: '1' = relay ON (load enabled)
 *              '0' = relay OFF (load disabled)
 *              'r' = reset cycle counter
 *              's' = status dump
 * ============================================================
 */

#include "Wire8.h" // THEJAS32 native I2C — TwoWire8 class

// ─── Pin / Address Config ────────────────────────────────────
#define DS18B20_PIN 4
#define RELAY_PIN 5 // IO5 — relay module IN
#define INA219_ADDR 0x40
#define ADS1015_ADDR 0x48
#define VDIV_RATIO 2.0f // R1=R2=10k -> output = Vbatt/2

// ─── Timing ──────────────────────────────────────────────────
#define LOOP_INTERVAL_MS 1000
#define TEMP_READ_INTERVAL_MS 2000 // DS18B20 every 2s (750ms conv)

// ─── Safety Cutoffs ──────────────────────────────────────────
#define TEMP_CUTOFF_HIGH_C 50.0f
#define VOLT_CUTOFF_LOW_V 2.8f
#define VOLT_CUTOFF_HIGH_V 4.35f

// ─── Cycle Detection Thresholds ──────────────────────────────
#define CYCLE_VOLTAGE_FULL_V 4.10f
#define CYCLE_VOLTAGE_EMPTY_V 3.00f
#define CHARGE_CURRENT_MIN_MA 50.0f

// ─── I2C Instance ────────────────────────────────────────────
TwoWire8 i2c(0); // THEJAS32 I2C bus 0

// ════════════════════════════════════════════════════════════
//  MOVING AVERAGE (n=4)
// ════════════════════════════════════════════════════════════
#define MA_N 4
struct MovAvg {
  float buf[MA_N];
  int idx;
  int count;

  void init() {
    idx = 0;
    count = 0;
    for (int i = 0; i < MA_N; i++)
      buf[i] = 0;
  }
  void push(float v) {
    buf[idx] = v;
    idx = (idx + 1) % MA_N;
    if (count < MA_N)
      count++;
  }
  float avg() {
    if (count == 0)
      return 0.0f;
    float s = 0;
    for (int i = 0; i < count; i++)
      s += buf[i];
    return s / (float)count;
  }
};

// ════════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════════
static bool ina219_ok = false;
static bool ads_ok = false;
static bool ds18_ok = false;
static bool relayState = false; // false = OFF (HIGH on active-LOW)

static long cycleCount = 0;
static bool wasCharging = false;
static bool wasEmpty = false;

static unsigned long lastLoop = 0;
static unsigned long lastTempRead = 0;
static float lastTempC = 25.0f; // fallback until first read
static bool tempConvPending = false;

static MovAvg ma_busV, ma_divV, ma_curr, ma_temp;

// ─── Edge Analytics State (dQ/dV & Coulomb) ─────────────
static float total_mAh = 0.0f;
static unsigned long last_q_time = 0;
static float last_v_for_dqdv = 0.0f;
static float q_since_last_v = 0.0f;

#define DQDV_BINS 24
#define DQDV_MIN_V 3.0f
#define DQDV_MAX_V 4.2f
static float dqdv_bins[DQDV_BINS] = {0};

void updateEdgeAnalytics(float currentMA, float busV) {
  unsigned long now = millis();
  if (last_q_time == 0) {
    last_q_time = now;
    last_v_for_dqdv = busV;
    return;
  }

  float dt_hours = (now - last_q_time) / 3600000.0f;
  last_q_time = now;

  float delta_mAh = currentMA * dt_hours;
  total_mAh += delta_mAh;

  // Track dQ absolute value
  q_since_last_v += abs(delta_mAh);

  float delta_v = busV - last_v_for_dqdv;

  // Update bin when voltage changes by at least 10mV
  if (abs(delta_v) >= 0.01f) {
    float dqdv = q_since_last_v / abs(delta_v);

    if (busV >= DQDV_MIN_V && busV <= DQDV_MAX_V) {
      int bin =
          (int)((busV - DQDV_MIN_V) / ((DQDV_MAX_V - DQDV_MIN_V) / DQDV_BINS));
      if (bin >= 0 && bin < DQDV_BINS) {
        if (dqdv_bins[bin] == 0)
          dqdv_bins[bin] = dqdv;
        else
          dqdv_bins[bin] = (dqdv_bins[bin] * 0.8f) + (dqdv * 0.2f);
      }
    }
    last_v_for_dqdv = busV;
    q_since_last_v = 0.0f;
  }
}

float getPeakDQDvVoltage() {
  float max_val = 0;
  int max_idx = -1;
  for (int i = 0; i < DQDV_BINS; i++) {
    if (dqdv_bins[i] > max_val) {
      max_val = dqdv_bins[i];
      max_idx = i;
    }
  }
  if (max_idx == -1)
    return 0.0f;
  return DQDV_MIN_V + (max_idx * ((DQDV_MAX_V - DQDV_MIN_V) / DQDV_BINS));
}

// ════════════════════════════════════════════════════════════
//  FORWARD DECLARATIONS
// ════════════════════════════════════════════════════════════

// I2C primitives
bool i2cProbe(uint8_t addr);
bool i2cWriteReg(uint8_t addr, uint8_t reg, uint8_t hi, uint8_t lo);
bool i2cReadReg(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t len);

// INA219
bool ina219Init();
bool ina219Read(float &busV, float &currentMA, float &powerMW);

// ADS1015
bool ads1015ReadChannel(uint8_t cfgHi, float lsb_mV, float &result_mV);
bool ads1015Read(float &battV);

// DS18B20
bool owReset(uint8_t pin);
void owWriteByte(uint8_t pin, uint8_t b);
uint8_t owReadByte(uint8_t pin);
bool ds18b20StartConversion();
bool ds18b20ReadResult(float &tempC);

// SoC estimation
float estimateSoC(float voltage);

// Relay
void relayOn();
void relayOff();

// Output
void emitJSON(float busV, float divV, float curr, float pwr, float temp,
              long cyc, bool rly, float soc, const char *health, float peakV,
              float mAh);
void banner();
void detectSensors();
void processSerial();

// ════════════════════════════════════════════════════════════
//  SETUP
// ════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  i2c.begin();

  // Relay pin — start OFF (HIGH for active-LOW module)
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);
  relayState = false;

  // DS18B20 data pin
  pinMode(DS18B20_PIN, INPUT);

  // Init moving averages
  ma_busV.init();
  ma_divV.init();
  ma_curr.init();
  ma_temp.init();

  delay(1500);
  banner();
  detectSensors();

  // Kick off first temperature conversion
  if (ds18_ok) {
    ds18b20StartConversion();
    tempConvPending = true;
    lastTempRead = millis();
  }
}

// ════════════════════════════════════════════════════════════
//  LOOP — runs at ~1 Hz
// ════════════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();
  if (now - lastLoop < LOOP_INTERVAL_MS)
    return;
  lastLoop = now;

  // ── 1. Process serial commands ──────────────────────────
  processSerial();

  // ── 2. Read INA219 ──────────────────────────────────────
  float busV_raw = 0, curr_raw = 0, pwr_raw = 0;
  bool got_ina = ina219_ok && ina219Read(busV_raw, curr_raw, pwr_raw);

  if (got_ina) {
    ma_busV.push(busV_raw);
    ma_curr.push(curr_raw);
  }

  // ── 3. Read ADS1015 AIN0 ───────────────────────────────
  float divV_raw = 0;
  bool got_ads = ads_ok && ads1015Read(divV_raw);

  if (got_ads) {
    ma_divV.push(divV_raw);
  }

  // ── 4. Read DS18B20 (async — non-blocking) ─────────────
  if (ds18_ok) {
    if (tempConvPending && (now - lastTempRead >= 800)) {
      // Conversion should be done (~750ms for 12-bit)
      float tc = 0;
      if (ds18b20ReadResult(tc)) {
        if (tc > -55.0f && tc < 125.0f && (int)tc != 85) {
          lastTempC = tc;
        }
      }
      tempConvPending = false;
    }

    if (!tempConvPending && (now - lastTempRead >= TEMP_READ_INTERVAL_MS)) {
      ds18b20StartConversion();
      tempConvPending = true;
      lastTempRead = now;
    }
  }
  ma_temp.push(lastTempC);

  // ── 5. Smoothed values ─────────────────────────────────
  float smooth_busV = ma_busV.avg();
  float smooth_divV = ma_divV.avg();
  float smooth_curr = ma_curr.avg();
  float smooth_temp = ma_temp.avg();
  float smooth_pwr = pwr_raw; // power isn't averaged (derived)

  // Use best available voltage for SoC
  float primaryV = got_ads ? smooth_divV : smooth_busV;

  // ── 6. Cycle counter ───────────────────────────────────
  //  Charging = current negative (flows into battery)
  bool isCharging =
      (smooth_curr < -CHARGE_CURRENT_MIN_MA && primaryV < CYCLE_VOLTAGE_FULL_V);
  bool isEmpty = (primaryV < CYCLE_VOLTAGE_EMPTY_V);

  if (isEmpty)
    wasEmpty = true;

  bool prevCharging = wasCharging;
  wasCharging = isCharging;

  // A cycle completes when battery went empty, then charged to full
  if (wasEmpty && prevCharging && !isCharging &&
      primaryV >= CYCLE_VOLTAGE_FULL_V) {
    cycleCount++;
    wasEmpty = false;
  }

  // ── 7. Safety cutoffs ──────────────────────────────────
  const char *health = "OK";

  if (relayState) {
    if (smooth_temp > TEMP_CUTOFF_HIGH_C) {
      relayOff();
      health = "TEMP_CUTOFF";
    } else if (primaryV < VOLT_CUTOFF_LOW_V) {
      relayOff();
      health = "UNDERVOLT_CUTOFF";
    } else if (primaryV > VOLT_CUTOFF_HIGH_V) {
      relayOff();
      health = "OVERVOLT_CUTOFF";
    }
  }

  // Non-fatal warnings
  if (smooth_temp > 45.0f && smooth_temp <= TEMP_CUTOFF_HIGH_C) {
    health = "WARN_TEMP_HIGH";
  }
  if (primaryV < 3.0f && primaryV >= VOLT_CUTOFF_LOW_V) {
    health = "WARN_VOLT_LOW";
  }

  // ── 8. SoC & Edge Analytics ────────────────────────────
  float soc = estimateSoC(primaryV);
  updateEdgeAnalytics(smooth_curr, primaryV);

  // ── 9. Emit JSON ───────────────────────────────────────
  float peak_v = getPeakDQDvVoltage();
  emitJSON(smooth_busV, smooth_divV, smooth_curr, smooth_pwr, smooth_temp,
           cycleCount, relayState, soc, health, peak_v, total_mAh);
}

// ════════════════════════════════════════════════════════════
//  SERIAL COMMAND PROCESSING
// ════════════════════════════════════════════════════════════
void processSerial() {
  while (Serial.available()) {
    char cmd = (char)Serial.read();
    switch (cmd) {
    case '1':
      relayOn();
      break;
    case '0':
      relayOff();
      break;
    case 'r':
    case 'R':
      cycleCount = 0;
      wasEmpty = false;
      wasCharging = false;
      Serial.println("{\"event\":\"cycle_reset\"}");
      break;
    case 's':
    case 'S':
      Serial.print("{\"event\":\"status\",\"ina219\":");
      Serial.print(ina219_ok ? "true" : "false");
      Serial.print(",\"ads1015\":");
      Serial.print(ads_ok ? "true" : "false");
      Serial.print(",\"ds18b20\":");
      Serial.print(ds18_ok ? "true" : "false");
      Serial.print(",\"relay\":");
      Serial.print(relayState ? 1 : 0);
      Serial.print(",\"uptime_s\":");
      Serial.print(millis() / 1000);
      Serial.println("}");
      break;
    }
  }
}

// ════════════════════════════════════════════════════════════
//  RELAY CONTROL
// ════════════════════════════════════════════════════════════
void relayOn() {
  relayState = true;
  digitalWrite(RELAY_PIN, LOW); // active-LOW: LOW = relay ON
}

void relayOff() {
  relayState = false;
  digitalWrite(RELAY_PIN, HIGH); // active-LOW: HIGH = relay OFF
}

// ════════════════════════════════════════════════════════════
//  SoC ESTIMATION — Voltage-based (Li-ion typical OCV curve)
//  Maps open-circuit voltage to approximate State of Charge.
//  Accuracy: ~±10% (voltage-only, load-dependent)
// ════════════════════════════════════════════════════════════
float estimateSoC(float voltage) {
  // Li-ion OCV vs SoC lookup (typical 18650 NMC/NCR)
  // Voltages are approximate open-circuit values
  static const float vtable[] = {3.00, 3.30, 3.50, 3.60, 3.70, 3.75, 3.80,
                                 3.85, 3.90, 3.95, 4.00, 4.10, 4.20};
  static const float stable[] = {0,  5,  10, 15, 25, 35, 45,
                                 55, 65, 75, 80, 90, 100};
  static const int tlen = 13;

  if (voltage <= vtable[0])
    return 0.0f;
  if (voltage >= vtable[tlen - 1])
    return 100.0f;

  for (int i = 1; i < tlen; i++) {
    if (voltage <= vtable[i]) {
      // Linear interpolation between table points
      float frac = (voltage - vtable[i - 1]) / (vtable[i] - vtable[i - 1]);
      return stable[i - 1] + frac * (stable[i] - stable[i - 1]);
    }
  }
  return 100.0f;
}

// ════════════════════════════════════════════════════════════
//  JSON EMITTER
// ════════════════════════════════════════════════════════════
void emitJSON(float busV, float divV, float curr, float pwr, float temp,
              long cyc, bool rly, float soc, const char *health, float peakV,
              float mAh) {
  Serial.print("{");
  Serial.print("\"busV\":");
  Serial.print(busV, 2);
  Serial.print(",\"divV\":");
  Serial.print(divV, 2);
  Serial.print(",\"current\":");
  Serial.print(curr, 2);
  Serial.print(",\"power\":");
  Serial.print(pwr, 2);
  Serial.print(",\"cellTemp\":");
  Serial.print(temp, 2);
  Serial.print(",\"cycle\":");
  Serial.print(cyc);
  Serial.print(",\"relay\":");
  Serial.print(rly ? 1 : 0);
  Serial.print(",\"soc\":");
  Serial.print(soc, 1);
  Serial.print(",\"health\":\"");
  Serial.print(health);
  Serial.print("\",\"peakV\":");
  Serial.print(peakV, 3);
  Serial.print(",\"mAh\":");
  Serial.print(mAh, 1);
  Serial.println("}");
}

// ════════════════════════════════════════════════════════════
//  SENSOR DETECTION (runs once at startup)
// ════════════════════════════════════════════════════════════
void detectSensors() {
  Serial.println("{\"event\":\"sensor_scan_start\"}");

  ina219_ok = i2cProbe(INA219_ADDR) && ina219Init();
  Serial.print("{\"sensor\":\"INA219\",\"addr\":\"0x40\",\"ok\":");
  Serial.print(ina219_ok ? "true" : "false");
  Serial.println("}");

  ads_ok = i2cProbe(ADS1015_ADDR);
  Serial.print("{\"sensor\":\"ADS1015\",\"addr\":\"0x48\",\"ok\":");
  Serial.print(ads_ok ? "true" : "false");
  Serial.println("}");

  ds18_ok = owReset(DS18B20_PIN);
  Serial.print("{\"sensor\":\"DS18B20\",\"pin\":4,\"ok\":");
  Serial.print(ds18_ok ? "true" : "false");
  Serial.println("}");

  Serial.println("{\"event\":\"sensor_scan_done\"}");
}

// ════════════════════════════════════════════════════════════
//  INA219 DRIVER
//  32V bus range, +/-2A, 12-bit continuous, 0.1Ohm shunt
// ════════════════════════════════════════════════════════════
#define INA219_REG_CONFIG 0x00
#define INA219_REG_CALIB 0x05
#define INA219_REG_BUSV 0x02
#define INA219_REG_CURRENT 0x04
#define INA219_REG_POWER 0x03

bool ina219Init() {
  // 0x399F: 32V bus, +/-2A shunt, 12-bit ADC, continuous shunt+bus
  if (!i2cWriteReg(INA219_ADDR, INA219_REG_CONFIG, 0x39, 0x9F))
    return false;
  // Cal = 4096 for current_LSB = 0.1mA with 0.1Ohm shunt
  if (!i2cWriteReg(INA219_ADDR, INA219_REG_CALIB, 0x10, 0x00))
    return false;
  return true;
}

bool ina219Read(float &busV, float &currentMA, float &powerMW) {
  uint8_t buf[2];

  // Bus voltage: bits [15:3], LSB = 4mV
  if (!i2cReadReg(INA219_ADDR, INA219_REG_BUSV, buf, 2))
    return false;
  int16_t rawBus = (int16_t)((buf[0] << 8) | buf[1]);
  busV = (float)(rawBus >> 3) * 0.004f;

  // Current: signed 16-bit, LSB = 0.1mA
  if (!i2cReadReg(INA219_ADDR, INA219_REG_CURRENT, buf, 2))
    return false;
  int16_t rawCurrent = (int16_t)((buf[0] << 8) | buf[1]);
  currentMA = (float)rawCurrent * 0.1f;

  // Power: unsigned 16-bit, LSB = 2mW
  if (!i2cReadReg(INA219_ADDR, INA219_REG_POWER, buf, 2))
    return false;
  int16_t rawPower = (int16_t)((buf[0] << 8) | buf[1]);
  powerMW = (float)rawPower * 2.0f;

  return true;
}

// ════════════════════════════════════════════════════════════
//  ADS1015 DRIVER (AIN0 — battery voltage divider)
//  Single-shot, MUX = AIN0 vs GND, PGA = +/-4.096V
//  LSB = 2mV (12-bit result)
// ════════════════════════════════════════════════════════════
#define ADS_REG_CONV 0x00
#define ADS_REG_CONFIG 0x01

bool ads1015ReadChannel(uint8_t cfgHi, float lsb_mV, float &result_mV) {
  if (!i2cWriteReg(ADS1015_ADDR, ADS_REG_CONFIG, cfgHi, 0x83))
    return false;
  delay(2); // 1600 SPS -> ~0.625ms/sample; 2ms safe margin

  uint8_t buf[2];
  if (!i2cReadReg(ADS1015_ADDR, ADS_REG_CONV, buf, 2))
    return false;

  int16_t raw = (int16_t)((buf[0] << 8) | buf[1]);
  raw >>= 4; // Top 12 bits

  result_mV = (float)raw * lsb_mV;
  return true;
}

bool ads1015Read(float &battV) {
  float mV0 = 0;
  // AIN0, +/-4.096V PGA, LSB = 2mV, config hi = 0xC3
  if (!ads1015ReadChannel(0xC3, 2.0f, mV0))
    return false;
  if (mV0 < 0)
    mV0 = 0;
  battV = (mV0 / 1000.0f) * VDIV_RATIO; // ×2 to undo divider
  return true;
}

// ════════════════════════════════════════════════════════════
//  I2C PRIMITIVES (THEJAS32 TwoWire8)
//  Note: THEJAS32 does NOT support repeated-start (Sr).
//        Register reads require two separate transactions.
// ════════════════════════════════════════════════════════════
bool i2cProbe(uint8_t addr) {
  i2c.beginTransmission(addr);
  return (i2c.endTransmission() == 0);
}

bool i2cWriteReg(uint8_t addr, uint8_t reg, uint8_t hi, uint8_t lo) {
  i2c.beginTransmission(addr);
  i2c.write(reg);
  i2c.write(hi);
  i2c.write(lo);
  return (i2c.endTransmission() == 0);
}

bool i2cReadReg(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t len) {
  // Transaction 1: point to register
  i2c.beginTransmission(addr);
  i2c.write(reg);
  if (i2c.endTransmission() != 0)
    return false;

  // Transaction 2: read bytes
  uint8_t got = i2c.requestFrom((uint8_t)addr, (uint8_t)len);
  if (got < len)
    return false;
  for (uint8_t i = 0; i < len; i++)
    buf[i] = (uint8_t)i2c.read();
  return true;
}

// ════════════════════════════════════════════════════════════
//  DS18B20 — BIT-BANG 1-WIRE (async: separate start / read)
// ════════════════════════════════════════════════════════════
bool owReset(uint8_t pin) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
  delayMicroseconds(480);
  pinMode(pin, INPUT);
  delayMicroseconds(70);
  bool present = (digitalRead(pin) == LOW);
  delayMicroseconds(410);
  return present;
}

static void owWriteBit(uint8_t pin, bool bit) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
  if (bit) {
    delayMicroseconds(6);
    pinMode(pin, INPUT);
    delayMicroseconds(64);
  } else {
    delayMicroseconds(60);
    pinMode(pin, INPUT);
    delayMicroseconds(10);
  }
}

static bool owReadBit(uint8_t pin) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
  delayMicroseconds(6);
  pinMode(pin, INPUT);
  delayMicroseconds(9);
  bool b = (digitalRead(pin) == HIGH);
  delayMicroseconds(55);
  return b;
}

void owWriteByte(uint8_t pin, uint8_t b) {
  for (uint8_t i = 0; i < 8; i++) {
    owWriteBit(pin, b & 0x01);
    b >>= 1;
  }
}

uint8_t owReadByte(uint8_t pin) {
  uint8_t v = 0;
  for (uint8_t i = 0; i < 8; i++) {
    if (owReadBit(pin))
      v |= (1 << i);
  }
  return v;
}

// Start conversion (non-blocking — call readResult after ~750ms)
bool ds18b20StartConversion() {
  if (!owReset(DS18B20_PIN))
    return false;
  owWriteByte(DS18B20_PIN, 0xCC); // skip ROM
  owWriteByte(DS18B20_PIN, 0x44); // convert T
  return true;
}

// Read scratchpad after conversion completes
bool ds18b20ReadResult(float &tempC) {
  if (!owReset(DS18B20_PIN))
    return false;
  owWriteByte(DS18B20_PIN, 0xCC); // skip ROM
  owWriteByte(DS18B20_PIN, 0xBE); // read scratchpad

  uint8_t lo = owReadByte(DS18B20_PIN);
  uint8_t hi = owReadByte(DS18B20_PIN);

  int16_t raw = (int16_t)((hi << 8) | lo);
  tempC = (float)raw * 0.0625f;

  return (tempC > -55.0f && tempC < 125.0f);
}

// ════════════════════════════════════════════════════════════
//  BANNER
// ════════════════════════════════════════════════════════════
void banner() {
  Serial.println();
  Serial.println("======================================");
  Serial.println("  Indra-BMS v0.5.0 — Full Measurement");
  Serial.println("  VSDSquadron ULTRA (THEJAS32)");
  Serial.println("======================================");
  Serial.println("  INA219 | ADS1015 AIN0 | DS18B20");
  Serial.println("  Relay @ IO5 | Power Resistor Load");
  Serial.println("======================================");
  Serial.println("  Serial Commands:");
  Serial.println("    1 = Relay ON  (enable load)");
  Serial.println("    0 = Relay OFF (disable load)");
  Serial.println("    r = Reset cycle counter");
  Serial.println("    s = Status dump");
  Serial.println("======================================");
  Serial.println();
}
