/*
 * Indra_BMS.ino
 * ─────────────────────────────────────────────────────────────
 * Indra-BMS v0.5 — Arduino IDE sketch
 * Target  : VSDSquadron ULTRA (or any Arduino-compatible board)
 * Baud    : 115200
 *
 * Hardware on this sketch:
 *   INA219  → I2C 0x40  (bus voltage + current)
 *   ADS1015 → I2C 0x48  (battery voltage via AIN0 divider)
 *   DS18B20 → GPIO 4    (cell temperature, 1-Wire)
 *   Relay   → GPIO 5    (load switch, active-LOW module)
 *
 * Output — one JSON line per second on Serial (115200 baud):
 *   {"busV":3.72,"current":1820.5,"cellTemp":27.3,"cycle":312,"relay":1}
 *
 * Required libraries (install via Arduino Library Manager):
 *   - Adafruit INA219          by Adafruit
 *   - Adafruit ADS1X15         by Adafruit
 *   - OneWire                  by Paul Stoffregen
 *   - DallasTemperature        by Miles Burton
 *
 * ─────────────────────────────────────────────────────────────
 */

#include <Wire.h>
#include <Adafruit_INA219.h>
#include <Adafruit_ADS1X15.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ── Pin definitions ───────────────────────────────────────────
#define DS18B20_PIN     4     // 1-Wire data (with 4.7kΩ pull-up to 3.3V)
#define RELAY_PIN       5     // Relay IN (active-LOW module)

// ── Voltage divider correction ────────────────────────────────
// R1 = R2 = 10kΩ → Vbat = V_AIN0 × 2
// ADS1015 PGA = ±4.096V → LSB = 2 mV (12-bit)
#define DIVIDER_RATIO   2.0f

// ── Cycle detection thresholds ────────────────────────────────
#define CHARGE_CURRENT_MA_MIN   50.0f   // above = charging
#define CYCLE_VOLTAGE_FULL_V    4.10f   // "full" threshold
#define CYCLE_VOLTAGE_EMPTY_V   3.00f   // "empty" threshold

// ── Safety cutoffs ────────────────────────────────────────────
#define TEMP_CUTOFF_C     50.0f
#define VOLT_CUTOFF_LOW_V  2.8f

// ── Objects ───────────────────────────────────────────────────
Adafruit_INA219    ina219;          // I2C 0x40
Adafruit_ADS1015   ads;             // I2C 0x48
OneWire            oneWire(DS18B20_PIN);
DallasTemperature  tempSensor(&oneWire);

// ── State ─────────────────────────────────────────────────────
long    cycleCount   = 0;
bool    relayState   = false;       // false = OFF
bool    wasCharging  = false;
bool    wasEmpty     = false;       // track discharge → charge transition

// ── Moving average (n=4) ──────────────────────────────────────
const int MA_N = 4;

struct MA {
  float  buf[4];
  int    idx     = 0;
  int    count   = 0;

  void push(float v) {
    buf[idx] = v;
    idx = (idx + 1) % MA_N;
    if (count < MA_N) count++;
  }

  float avg() {
    if (count == 0) return 0.0f;
    float s = 0;
    for (int i = 0; i < count; i++) s += buf[i];
    return s / count;
  }
};

MA ma_v, ma_i, ma_t;

// ─────────────────────────────────────────────────────────────
void setup()
{
  Serial.begin(115200);
  while (!Serial) { }   // wait for USB-Serial on boards that need it

  // Relay OFF at boot (active-LOW: HIGH = relay off)
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  Wire.begin();

  // INA219
  if (!ina219.begin()) {
    Serial.println("{\"error\":\"INA219 not found — check wiring and I2C address 0x40\"}");
    while (1) delay(1000);
  }

  // ADS1015
  ads.setGain(GAIN_ONE);    // ±4.096V — safe for 0–4.2V after divider
  if (!ads.begin()) {
    Serial.println("{\"error\":\"ADS1015 not found — check wiring and I2C address 0x48\"}");
    while (1) delay(1000);
  }

  // DS18B20
  tempSensor.begin();
  if (tempSensor.getDeviceCount() == 0) {
    // Not fatal — will return error sentinel; log once and continue
    Serial.println("{\"warning\":\"DS18B20 not found — check 1-Wire wiring on GPIO4\"}");
  }
  tempSensor.setResolution(12);   // 12-bit = 0.0625°C, ~750ms conversion

  delay(200);
}

// ─────────────────────────────────────────────────────────────
void loop()
{
  unsigned long t0 = millis();

  // ── 1. Read INA219 ──────────────────────────────────────────
  float busV_raw   = ina219.getBusVoltage_V();
  float curr_mA_raw = ina219.getCurrent_mA();

  // Current: clamp to positive (discharge current)
  if (curr_mA_raw < 0.0f) curr_mA_raw = 0.0f;
  if (curr_mA_raw > 3200.0f) curr_mA_raw = 3200.0f;

  // ── 2. Read ADS1015 (AIN0 = divider midpoint) ───────────────
  int16_t raw_adc = ads.readADC_SingleEnded(0);
  // ADS1015 with GAIN_ONE: LSB = 2 mV
  float v_mid = raw_adc * 0.002f;
  float ads_v = v_mid * DIVIDER_RATIO;

  // Cross-check: use ADS voltage if INA219 reads implausible
  float busV = busV_raw;
  if (busV < 2.5f || busV > 4.3f) busV = ads_v;
  busV = constrain(busV, 2.5f, 4.25f);

  // ── 3. Read DS18B20 ─────────────────────────────────────────
  tempSensor.requestTemperatures();
  float tempC = tempSensor.getTempCByIndex(0);

  // DEVICE_DISCONNECTED_C = -127 → use fallback
  if (tempC < -10.0f || tempC > 100.0f) tempC = 25.0f;

  // ── 4. Apply moving average ──────────────────────────────────
  ma_v.push(busV);
  ma_i.push(curr_mA_raw);
  ma_t.push(tempC);

  float smooth_v    = ma_v.avg();
  float smooth_i    = ma_i.avg();
  float smooth_temp = ma_t.avg();

  // ── 5. Cycle counter ─────────────────────────────────────────
  // Track: battery goes empty → then fully charged = 1 cycle
  bool isCharging = (smooth_i > CHARGE_CURRENT_MA_MIN && smooth_v < CYCLE_VOLTAGE_FULL_V);
  bool isEmpty    = (smooth_v < CYCLE_VOLTAGE_EMPTY_V);

  if (isEmpty) wasEmpty = true;

  // Cycle complete: was empty, now finished charging
  if (wasEmpty && wasCharging && !isCharging && smooth_v >= CYCLE_VOLTAGE_FULL_V) {
    cycleCount++;
    wasEmpty = false;
  }
  wasCharging = isCharging;

  // ── 6. Safety cutoff ─────────────────────────────────────────
  if (relayState && (smooth_temp > TEMP_CUTOFF_C || smooth_v < VOLT_CUTOFF_LOW_V)) {
    relayState = false;
    digitalWrite(RELAY_PIN, HIGH);  // active-LOW: HIGH = relay off
  }

  // ── 7. Emit JSON ─────────────────────────────────────────────
  // Format: {"busV":3.72,"current":1820.5,"cellTemp":27.30,"cycle":312,"relay":1}
  Serial.print("{");
  Serial.print("\"busV\":");    Serial.print(smooth_v,    2);
  Serial.print(",\"current\":"); Serial.print(smooth_i,   1);
  Serial.print(",\"cellTemp\":"); Serial.print(smooth_temp, 2);
  Serial.print(",\"cycle\":");  Serial.print(cycleCount);
  Serial.print(",\"relay\":");  Serial.print(relayState ? 1 : 0);
  Serial.println("}");

  // ── 8. Hold 1-second interval ────────────────────────────────
  long elapsed = (long)(millis() - t0);
  if (elapsed < 1000) delay(1000 - elapsed);
}
