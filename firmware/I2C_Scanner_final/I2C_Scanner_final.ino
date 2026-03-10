/*
 * I2C_Scanner.ino — Indra-BMS Pre-flight Check
 * Only scans for INA219 (0x40) and ADS1015 (0x48)
 * No OneWire / DallasTemperature needed here.
 *
 * Baud: 115200
 */

#include <Wire.h>

#define INA219_ADDR   0x40
#define ADS1015_ADDR  0x48

void setup()
{
  Serial.begin(115200);
  while (!Serial) { }
  Wire.begin();

  Serial.println("================================================");
  Serial.println("  Indra-BMS I2C Scanner");
  Serial.println("================================================");
}

void loop()
{
  Serial.println("Scanning...");

  int  found      = 0;
  bool ina219_ok  = false;
  bool ads1015_ok = false;

  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    byte err = Wire.endTransmission();

    if (err == 0) {
      found++;
      Serial.print("  [FOUND] 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      Serial.print("  ->  ");

      if      (addr == INA219_ADDR)  { Serial.println("INA219  OK"); ina219_ok  = true; }
      else if (addr == ADS1015_ADDR) { Serial.println("ADS1015 OK"); ads1015_ok = true; }
      else                           { Serial.println("Unknown");                        }
    }
    delay(5);
  }

  Serial.println();
  Serial.print("INA219  (0x40): "); Serial.println(ina219_ok  ? "OK" : "NOT FOUND — check wiring");
  Serial.print("ADS1015 (0x48): "); Serial.println(ads1015_ok ? "OK" : "NOT FOUND — check wiring");
  Serial.println();
  Serial.println(ina219_ok && ads1015_ok
    ? "ALL CLEAR — ready for Indra_BMS.ino"
    : "FIX WIRING before proceeding.");
  Serial.println("================================================");
  delay(5000);
}
