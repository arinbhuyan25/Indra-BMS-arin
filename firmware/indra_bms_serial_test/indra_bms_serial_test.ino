/*
 * ============================================================
 *  Indra-BMS — Serial Link Test Firmware
 *  Board:   VSD Squadron ULTRA (THEJAS32 / RISC-V)
 *  Version: 0.1.0
 *  Purpose: Establish basic serial communication over UART
 *           as foundation for the BMS telemetry pipeline.
 * ============================================================
 *
 *  Commands (send via Serial Monitor at 115200 baud):
 *    ping     -> responds "pong"
 *    info     -> prints device & project metadata
 *    status   -> prints uptime and free memory estimate
 *    help     -> lists available commands
 *    <other>  -> echoes input back
 *
 *  NOTE: Uses raw char buffer instead of String class
 *        (VEGA ARIES core doesn't link Stream::readStringUntil)
 * ============================================================
 */

// --- Configuration ---
#define SERIAL_BAUD       115200
#define HEARTBEAT_MS      5000
#define CMD_BUFFER_SIZE   64
#define LED_PIN           LED_BUILTIN

// --- State ---
static char cmdBuffer[CMD_BUFFER_SIZE];
static uint8_t cmdIndex = 0;
static unsigned long lastHeartbeat = 0;
static unsigned long bootTime = 0;
static unsigned long cmdCount = 0;
static bool ledState = false;

// --- Forward declarations ---
void processCommand(const char* cmd);
void cmdPing();
void cmdInfo();
void cmdStatus();
void cmdHelp();
void cmdReset();
void blinkLED();
void printBanner();
bool strEquals(const char* a, const char* b);

// --- Setup ---
void setup() {
  Serial.begin(SERIAL_BAUD);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  delay(1500);
  bootTime = millis();

  printBanner();
}

// --- Main Loop ---
void loop() {
  // Read serial one char at a time (no String class needed)
  while (Serial.available()) {
    char c = (char)Serial.read();

    if (c == '\n' || c == '\r') {
      if (cmdIndex > 0) {
        cmdBuffer[cmdIndex] = '\0';
        processCommand(cmdBuffer);
        cmdIndex = 0;
      }
    } else {
      if (cmdIndex < CMD_BUFFER_SIZE - 1) {
        cmdBuffer[cmdIndex++] = c;
      }
    }
  }

  // Periodic heartbeat
  unsigned long now = millis();
  if (now - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = now;
    unsigned long uptimeSec = (now - bootTime) / 1000;

    Serial.print("[HB] t=");
    Serial.print(uptimeSec);
    Serial.print("s cmds=");
    Serial.println(cmdCount);

    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  }
}

// --- Command Router ---
void processCommand(const char* cmd) {
  cmdCount++;
  blinkLED();

  if (strEquals(cmd, "ping")) {
    cmdPing();
  } else if (strEquals(cmd, "info")) {
    cmdInfo();
  } else if (strEquals(cmd, "status")) {
    cmdStatus();
  } else if (strEquals(cmd, "help")) {
    cmdHelp();
  } else if (strEquals(cmd, "reset")) {
    cmdReset();
  } else {
    Serial.print("[ECHO] ");
    Serial.println(cmd);
  }
}

// --- Commands ---

void cmdPing() {
  Serial.println("pong");
}

void cmdInfo() {
  Serial.println("--- DEVICE INFO ---");
  Serial.println("Project : Indra-BMS");
  Serial.println("Board   : VSDSquadron ULTRA");
  Serial.println("Chip    : THEJAS32 (VEGA ET1031)");
  Serial.println("Arch    : RISC-V RV32IM @ 100MHz");
  Serial.println("Firmware: v0.1.0");
  Serial.println("-------------------");
}

void cmdStatus() {
  unsigned long uptimeSec = (millis() - bootTime) / 1000;
  unsigned long uptimeMin = uptimeSec / 60;
  unsigned long uptimeHrs = uptimeMin / 60;

  Serial.println("--- SYSTEM STATUS ---");
  Serial.print("Uptime   : ");
  Serial.print(uptimeHrs);
  Serial.print("h ");
  Serial.print(uptimeMin % 60);
  Serial.print("m ");
  Serial.print(uptimeSec % 60);
  Serial.println("s");
  Serial.print("Millis   : ");
  Serial.println(millis());
  Serial.print("Commands : ");
  Serial.println(cmdCount);
  Serial.print("LED      : ");
  Serial.println(ledState ? "ON" : "OFF");
  Serial.println("---------------------");
}

void cmdHelp() {
  Serial.println("--- COMMANDS ---");
  Serial.println("ping   - Connection check");
  Serial.println("info   - Device information");
  Serial.println("status - System status");
  Serial.println("help   - This help menu");
  Serial.println("reset  - Reset counters");
  Serial.println("<text> - Echo back");
  Serial.println("----------------");
}

void cmdReset() {
  cmdCount = 0;
  bootTime = millis();
  Serial.println("[OK] Counters reset.");
}

// --- Utilities ---

void blinkLED() {
  digitalWrite(LED_PIN, HIGH);
  delay(50);
  digitalWrite(LED_PIN, LOW);
}

bool strEquals(const char* a, const char* b) {
  while (*a && *b) {
    // Case-insensitive compare
    char ca = *a;
    char cb = *b;
    if (ca >= 'A' && ca <= 'Z') ca += 32;
    if (cb >= 'A' && cb <= 'Z') cb += 32;
    if (ca != cb) return false;
    a++;
    b++;
  }
  return (*a == '\0' && *b == '\0');
}

void printBanner() {
  Serial.println();
  Serial.println("========================================");
  Serial.println("   ___ _   _ ____  ____      _          ");
  Serial.println("  |_ _| \\ | |  _ \\|  _ \\    / \\       ");
  Serial.println("   | ||  \\| | | | | |_) |  / _ \\      ");
  Serial.println("   | || |\\  | |_| |  _ <  / ___ \\     ");
  Serial.println("  |___|_| \\_|____/|_| \\_\\/_/   \\_\\  ");
  Serial.println("                                        ");
  Serial.println("  Battery Management System v0.1.0      ");
  Serial.println("  Edge-Native | Physics-Informed        ");
  Serial.println("========================================");
  Serial.println("  Board : VSDSquadron ULTRA (THEJAS32)  ");
  Serial.println("  Arch  : RISC-V RV32IM @ 100MHz       ");
  Serial.println("  Baud  : 115200                        ");
  Serial.println("  Type 'help' for commands              ");
  Serial.println("========================================");
  Serial.println();
}
