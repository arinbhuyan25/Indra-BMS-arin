/*
 * ============================================================
 *  Indra-BMS — Full Circuit Test v0.4.0
 *  Board   : VSD Squadron ULTRA (THEJAS32 / RISC-V RV32IM)
 *  Purpose : Verify sensors — INA219, ADS1015 (AIN0), DS18B20
 * ============================================================
 *
 *  NO EXTERNAL LIBRARIES — driven via THEJAS32 IIC registers.
 *
 *  HARDWARE:
 *    INA219   -> I2C0 (SDA/SCL) addr 0x40  Battery V + I
 *    ADS1015  -> I2C0 (SDA/SCL) addr 0x48  On-board ADC
 *      AIN0   -> Battery voltage divider (R1=R2=10kOhm -> V/2)
 *    DS18B20  -> GPIO4, 1-Wire, 4.7kOhm pull-up to 3.3V
 *
 *  WIRING (TP4056 -> INA219 -> Battery -> Divider -> AIN0):
 *    TP4056 B+  -> INA219 VIN+  -> INA219 VIN-  -> Battery B+
 *    Battery B+ -> R1(10k) -> Junction -> R2(10k) -> GND
 *    Junction   -> ADS1015 AIN0
 *    Battery B- -> GND
 *
 *  SERIAL: 115200 baud. Open monitor, press RESET.
 * ============================================================
 */

#include "Wire8.h"   // THEJAS32 native I2C — TwoWire8 class

// ─── Pin / Address Config ────────────────────────────────────
#define DS18B20_PIN    4
#define INA219_ADDR    0x40
#define ADS1015_ADDR   0x48
#define VDIV_RATIO     2.0f   // R1=R2=10k -> output = Vbatt/2
#define POLL_MS        3000

// ─── I2C Instance ────────────────────────────────────────────
TwoWire8 i2c(0);   // THEJAS32 I2C bus 0 (SDA/SCL header pins)

// ─── Sensor Availability Flags ───────────────────────────────
static bool ina219_ok = false;
static bool ads_ok    = false;
static bool ds18_ok   = false;
static unsigned long lastPoll = 0;

// ════════════════════════════════════════════════════════════
//  FORWARD DECLARATIONS
// ════════════════════════════════════════════════════════════

// I2C primitives
bool    i2cProbe(uint8_t addr);
bool    i2cWriteReg(uint8_t addr, uint8_t reg, uint8_t hi, uint8_t lo);
bool    i2cReadReg(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t len);

// INA219
bool    ina219Init();
bool    ina219Read(float &busV, float &currentMA, float &powerMW);

// ADS1015
bool    ads1015ReadChannel(uint8_t cfgHi, float lsb_mV, float &result_mV);
bool    ads1015Read(float &battV);

// DS18B20 — 1-Wire
bool    owReset(uint8_t pin);
void    owWriteByte(uint8_t pin, uint8_t b);
uint8_t owReadByte(uint8_t pin);
bool    ds18b20Read(float &tempC);

// Output helpers
void    pval(const char *lbl, float v, uint8_t dp, const char *unit);
void    pline(const char *s);
void    sep();
void    banner();
void    detectSensors();

// ════════════════════════════════════════════════════════════
//  SETUP
// ════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  i2c.begin();
  pinMode(DS18B20_PIN, INPUT);
  delay(1500);
  banner();
  detectSensors();
}

// ════════════════════════════════════════════════════════════
//  LOOP
// ════════════════════════════════════════════════════════════
void loop() {
  if (millis() - lastPoll < POLL_MS) return;
  lastPoll = millis();

  float busV = 0, currentMA = 0, powerMW = 0;
  float battV = 0, cellC = 0;

  bool got_ina = ina219_ok && ina219Read(busV, currentMA, powerMW);
  bool got_ads = ads_ok    && ads1015Read(battV);
  bool got_ds  = ds18_ok   && ds18b20Read(cellC);

  sep();
  pline("  Indra-BMS Readings");
  sep();

  // ── INA219 ──────────────────────────────────────────────
  pline("[INA219] Charging Current + Voltage");
  if (got_ina) {
    pval("  Bus Voltage", busV,      2, " V");
    pval("  Current    ", currentMA, 2, " mA");
    pval("  Power      ", powerMW,   2, " mW");
    pline((busV > 0.5f) ? "  [PASS]" : "  [WARN] Low voltage — is battery connected?");
  } else {
    pline("  [FAIL] INA219 not responding — check SDA/SCL wiring");
  }
  pline("");

  // ── ADS1015 AIN0 (battery divider) ──────────────────────
  pline("[ADS1015] Battery Voltage via Divider (AIN0)");
  if (got_ads) {
    pval("  Batt Voltage", battV, 2, " V");
    if (battV >= 3.0f && battV <= 4.3f) {
      pline("  [PASS] Voltage in healthy Li-ion range");
    } else if (battV > 0.1f) {
      pline("  [WARN] Voltage outside 3.0-4.3V — check divider or battery");
    } else {
      pline("  [WARN] AIN0 near zero — check R1/R2 wiring to Battery B+");
    }
  } else {
    pline("  [FAIL] ADS1015 not responding — check I2C addr 0x48");
  }
  pline("");

  // ── DS18B20 ─────────────────────────────────────────────
  pline("[DS18B20] Cell Temperature");
  if (got_ds) {
    pval("  Cell Temp", cellC, 2, " C");
    if ((int)cellC == 85) {
      pline("  [WARN] 85C = power-on default — conversion may not have run yet");
    } else if (cellC >= -10.0f && cellC <= 60.0f) {
      pline("  [PASS]");
      if (cellC > 45.0f) pline("  [WARN] Cell temp > 45C — battery getting warm");
    } else {
      pline("  [FAIL] Reading out of -10 to 60C range — check wiring + pull-up");
    }
  } else {
    pline("  [FAIL] DS18B20 not found — check GPIO4 and 4.7kOhm pull-up");
  }

  sep();
  pline("");
}

// ════════════════════════════════════════════════════════════
//  SENSOR DETECTION (runs once at startup)
// ════════════════════════════════════════════════════════════
void detectSensors() {
  pline("--- Sensor Scan ---");

  ina219_ok = i2cProbe(INA219_ADDR) && ina219Init();
  pline(ina219_ok ? "[OK]  INA219   @ 0x40" : "[--]  INA219   NOT found");

  ads_ok = i2cProbe(ADS1015_ADDR);
  pline(ads_ok ? "[OK]  ADS1015  @ 0x48" : "[--]  ADS1015  NOT found");

  ds18_ok = owReset(DS18B20_PIN);
  pline(ds18_ok ? "[OK]  DS18B20  on GPIO4" : "[--]  DS18B20  NOT found");

  pline("-------------------");
  pline("");
}

// ════════════════════════════════════════════════════════════
//  INA219 DRIVER
//  Measures: bus voltage (reg 0x02), current (reg 0x04), power (reg 0x03)
//  Config:   32V bus range, +/-2A, 12-bit continuous, 0.1Ohm shunt
// ════════════════════════════════════════════════════════════
#define INA219_REG_CONFIG  0x00
#define INA219_REG_CALIB   0x05
#define INA219_REG_BUSV    0x02
#define INA219_REG_CURRENT 0x04
#define INA219_REG_POWER   0x03

bool ina219Init() {
  // 0x399F: 32V bus, +/-2A shunt, 12-bit ADC, continuous shunt+bus
  if (!i2cWriteReg(INA219_ADDR, INA219_REG_CONFIG, 0x39, 0x9F)) return false;
  // Cal = 4096 for current_LSB = 0.1mA with 0.1Ohm shunt
  if (!i2cWriteReg(INA219_ADDR, INA219_REG_CALIB,  0x10, 0x00)) return false;
  return true;
}

bool ina219Read(float &busV, float &currentMA, float &powerMW) {
  uint8_t buf[2];

  // Bus voltage reg: bits [15:3] hold result, LSB = 4mV
  if (!i2cReadReg(INA219_ADDR, INA219_REG_BUSV, buf, 2)) return false;
  int16_t rawBus = (int16_t)((buf[0] << 8) | buf[1]);
  busV = (float)(rawBus >> 3) * 0.004f;

  // Current reg: signed 16-bit, LSB = 0.1mA (from calibration)
  if (!i2cReadReg(INA219_ADDR, INA219_REG_CURRENT, buf, 2)) return false;
  int16_t rawCurrent = (int16_t)((buf[0] << 8) | buf[1]);
  currentMA = (float)rawCurrent * 0.1f;

  // Power reg: unsigned 16-bit, LSB = 2mW (= 20 * current_LSB)
  if (!i2cReadReg(INA219_ADDR, INA219_REG_POWER, buf, 2)) return false;
  int16_t rawPower = (int16_t)((buf[0] << 8) | buf[1]);
  powerMW = (float)rawPower * 2.0f;

  return true;
}

// ════════════════════════════════════════════════════════════
//  ADS1015 DRIVER (AIN0 only — battery voltage divider)
//  Single-shot mode, MUX = AIN0 vs GND, PGA = +/-4.096V
//  At PGA +/-4.096V: 1 LSB = 2mV (12-bit result, top 12 bits)
// ════════════════════════════════════════════════════════════
#define ADS_REG_CONV   0x00
#define ADS_REG_CONFIG 0x01

// Config byte hi for AIN0 single-shot +/-4.096V:
//   OS=1, MUX=100(AIN0-GND), PGA=001(+/-4.096V), MODE=1(single)
//   bit pattern: 1_100_001_1 = 0xC3
// Config byte lo for 1600sps defaults: 0x83

bool ads1015ReadChannel(uint8_t cfgHi, float lsb_mV, float &result_mV) {
  if (!i2cWriteReg(ADS1015_ADDR, ADS_REG_CONFIG, cfgHi, 0x83)) return false;
  delay(2);   // 1600 SPS -> 0.625ms/sample; 2ms is safe margin

  uint8_t buf[2];
  if (!i2cReadReg(ADS1015_ADDR, ADS_REG_CONV, buf, 2)) return false;

  // ADS1015 result occupies top 12 bits — shift right by 4
  int16_t raw = (int16_t)((buf[0] << 8) | buf[1]);
  raw >>= 4;

  result_mV = (float)raw * lsb_mV;
  return true;
}

bool ads1015Read(float &battV) {
  float mV0 = 0;
  // AIN0, +/-4.096V PGA, LSB = 2mV, config hi = 0xC3
  if (!ads1015ReadChannel(0xC3, 2.0f, mV0)) return false;
  if (mV0 < 0) mV0 = 0;
  battV = (mV0 / 1000.0f) * VDIV_RATIO;   // multiply by 2 to undo divider
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
  // Transaction 1: point device to register
  i2c.beginTransmission(addr);
  i2c.write(reg);
  if (i2c.endTransmission() != 0) return false;

  // Transaction 2: clock out the bytes
  uint8_t got = i2c.requestFrom((uint8_t)addr, (uint8_t)len);
  if (got < len) return false;
  for (uint8_t i = 0; i < len; i++) buf[i] = (uint8_t)i2c.read();
  return true;
}

// ════════════════════════════════════════════════════════════
//  DS18B20 — BIT-BANG 1-WIRE
//  All timing in microseconds per DS18B20 datasheet (Table 1).
// ════════════════════════════════════════════════════════════
bool owReset(uint8_t pin) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
  delayMicroseconds(480);   // master reset pulse (480-640us)
  pinMode(pin, INPUT);      // release — pull-up brings line HIGH
  delayMicroseconds(70);    // wait for presence pulse (15-60us after release)
  bool present = (digitalRead(pin) == LOW);  // sensor pulls low
  delayMicroseconds(410);   // complete the reset slot (total >= 480us)
  return present;
}

static void owWriteBit(uint8_t pin, bool bit) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
  if (bit) {
    delayMicroseconds(6);   // write-1: hold LOW 6us then release
    pinMode(pin, INPUT);
    delayMicroseconds(64);
  } else {
    delayMicroseconds(60);  // write-0: hold LOW 60us then release
    pinMode(pin, INPUT);
    delayMicroseconds(10);
  }
}

static bool owReadBit(uint8_t pin) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
  delayMicroseconds(6);     // initiate read slot
  pinMode(pin, INPUT);      // release — sensor drives or lets float
  delayMicroseconds(9);     // sample within 15us of slot start
  bool b = (digitalRead(pin) == HIGH);
  delayMicroseconds(55);    // complete the 70us slot
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
    if (owReadBit(pin)) v |= (1 << i);
  }
  return v;
}

bool ds18b20Read(float &tempC) {
  // Step 1: trigger temperature conversion
  if (!owReset(DS18B20_PIN)) return false;
  owWriteByte(DS18B20_PIN, 0xCC);   // skip ROM (only one device on bus)
  owWriteByte(DS18B20_PIN, 0x44);   // convert T command
  delay(750);                        // 12-bit conversion takes up to 750ms

  // Step 2: read scratchpad
  if (!owReset(DS18B20_PIN)) return false;
  owWriteByte(DS18B20_PIN, 0xCC);   // skip ROM
  owWriteByte(DS18B20_PIN, 0xBE);   // read scratchpad command

  uint8_t lo = owReadByte(DS18B20_PIN);   // byte 0: temp LSB
  uint8_t hi = owReadByte(DS18B20_PIN);   // byte 1: temp MSB

  // DS18B20 raw output: 16-bit signed, 1 LSB = 0.0625°C
  int16_t raw = (int16_t)((hi << 8) | lo);
  tempC = (float)raw * 0.0625f;

  return (tempC > -55.0f && tempC < 125.0f);
}

// ════════════════════════════════════════════════════════════
//  PRINT HELPERS
// ════════════════════════════════════════════════════════════
void pval(const char *lbl, float v, uint8_t dp, const char *unit) {
  Serial.print(lbl);
  Serial.print(": ");
  Serial.print(v, dp);
  Serial.println(unit);
}

void pline(const char *s) {
  Serial.println(s);
}

void sep() {
  pline("==============================");
}

void banner() {
  pline("");
  sep();
  pline("  Indra-BMS Circuit Test v0.4");
  pline("  VSDSquadron ULTRA (THEJAS32)");
  sep();
  pline("  INA219  | ADS1015 AIN0 | DS18B20");
  sep();
  pline("");
}
