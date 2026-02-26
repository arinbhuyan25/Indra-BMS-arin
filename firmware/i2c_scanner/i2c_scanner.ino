/*
 * ============================================================
 *  THEJAS32 I2C Bus Scanner
 *  Scans I2C port 0 AND port 1 to find all connected devices.
 *  This tells us definitively which bus the ADS1015 is on.
 * ============================================================
 *  Upload → Open Serial Monitor @ 115200 → Press RESET
 * ============================================================
 */

#include "Wire8.h"

TwoWire8 i2c0(0);   // IIC0
TwoWire8 i2c1(1);   // IIC1

void scanBus(TwoWire8 &bus, uint8_t busId) {
  Serial.print("--- Scanning I2C Port ");
  Serial.print(busId);
  Serial.println(" ---");

  uint8_t found = 0;
  for (uint8_t addr = 0x08; addr <= 0x77; addr++) {
    bus.beginTransmission(addr);
    uint8_t err = bus.endTransmission();

    if (err == 0) {
      Serial.print("  [FOUND] 0x");
      if (addr < 0x10) Serial.print("0");
      Serial.print(addr, HEX);
      // Print known device names
      if      (addr == 0x40) Serial.print("  <- INA219");
      else if (addr == 0x41) Serial.print("  <- INA219 (alt)");
      else if (addr == 0x48) Serial.print("  <- ADS1015/ADS1115 or TMP102");
      else if (addr == 0x49) Serial.print("  <- ADS1015 (ADDR=VDD)");
      else if (addr == 0x3C) Serial.print("  <- SSD1306 OLED");
      else if (addr == 0x68) Serial.print("  <- MPU6050 / DS3231 RTC");
      else if (addr == 0x76) Serial.print("  <- BME280");
      Serial.println();
      found++;
    }
    delay(3);   // Small gap between probes for bus stability
  }

  if (found == 0) {
    Serial.println("  (no devices found)");
  }
  Serial.print("  Total: ");
  Serial.print(found);
  Serial.println(" device(s)");
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  i2c0.begin();
  i2c1.begin();
  delay(1500);

  Serial.println();
  Serial.println("==============================");
  Serial.println("  THEJAS32 I2C Bus Scanner");
  Serial.println("==============================");
  Serial.println();

  scanBus(i2c0, 0);
  scanBus(i2c1, 1);

  Serial.println("==============================");
  Serial.println("  Scan complete.");
  Serial.println("==============================");
}

void loop() {
  // Nothing — scan runs once at boot
}
