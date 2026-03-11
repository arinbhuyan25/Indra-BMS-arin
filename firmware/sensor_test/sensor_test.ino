#include <Arduino.h>
#include <Wire8.h>

// --- HARDWARE WIRING PINS ---
#define RELAY_PIN 5
#define DS18B20_PIN 4

// --- I2C ADDRESSES ---
#define INA219_ADDR 0x40
#define ADS1015_ADDR 0x48

TwoWire8 myWire(0); // Use I2C port 0 for THEJAS32 bare-metal

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n==================================");
  Serial.println("  INDRA-BMS HARDWARE DIAGNOSTIC");
  Serial.println("==================================");

  // 1. Initialize Relay
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // Start OFF (Active-LOW assumed)
  Serial.println("[OK] Relay Initialized to OFF.");

  // 2. Initialize I2C Bus
  myWire.begin();
  myWire.setClock(100000); // Standard 100kHz I2C speed
  Serial.println("[OK] I2C Bus (Wire8) Started.");
  delay(1000);
}

void loop() {
  Serial.println("\n--- Starting Sensor Scan ---");

  // --- TEST DS18B20 TEMP SENSOR ---
  Serial.print("DS18B20 Temp Sensor: ");
  pinMode(DS18B20_PIN, OUTPUT);
  digitalWrite(DS18B20_PIN, LOW);
  delayMicroseconds(500); // Reset pulse
  pinMode(DS18B20_PIN, INPUT_PULLUP);
  delayMicroseconds(60); // Wait for presence
  bool ds18_present = (digitalRead(DS18B20_PIN) == LOW);
  delayMicroseconds(400); // End slot
  if (ds18_present) {
    Serial.println("DETECTED [OK]");
  } else {
    Serial.println("NOT FOUND (Check GPIO4 + 4.7k Resistor)");
  }
  delay(500);

  // --- TEST INA219 VOLTAGE & CURRENT SENSOR ---
  Serial.print("INA219 Main Sensor: ");
  myWire.beginTransmission(INA219_ADDR);
  if (myWire.endTransmission(false) == 0) {
    Serial.println("DETECTED [OK]");

    // Read the raw Bus Voltage register to prove it works
    myWire.beginTransmission(INA219_ADDR);
    myWire.write(0x02); // Point to Bus Voltage
    myWire.endTransmission(false);
    if (myWire.requestFrom(INA219_ADDR, 2) == 2) {
      uint16_t busReg = (myWire.read() << 8) | myWire.read();
      float voltage = (busReg >> 3) * 0.004; // 4mV per LSB
      Serial.print("  -> Live Bus Voltage: ");
      Serial.print(voltage, 2);
      Serial.println(" V");
    }
  } else {
    Serial.println("NOT FOUND at 0x40 (Check wiring)");
  }
  delay(500);

  // --- TEST ADS1015 AUX VOLTAGE SENSOR ---
  Serial.print("ADS1015 Aux ADC: ");
  myWire.beginTransmission(ADS1015_ADDR);
  if (myWire.endTransmission(false) == 0) {
    Serial.println("DETECTED [OK]");
  } else {
    Serial.println("NOT FOUND at 0x48 (Check wiring)");
  }
  delay(500);

  // --- TEST RELAY SWITCHING ---
  Serial.println("RELAY TEST: Clicking ON...");
  digitalWrite(RELAY_PIN, LOW); // Active-LOW: Turn ON
  delay(1000);

  Serial.println("RELAY TEST: Clicking OFF...");
  digitalWrite(RELAY_PIN, HIGH); // Active-LOW: Turn OFF
  delay(1000);

  Serial.println("----------------------------");
  delay(3000); // Wait 3 seconds before repeating the diagnostics
}
