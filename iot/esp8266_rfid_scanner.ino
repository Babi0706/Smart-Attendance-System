/**
 * =========================================================
 * SMART ATTENDANCE RFID SYSTEM
 * ESP8266 + RC522 + LCD + MQTT
 * =========================================================
 *
 * FEATURES:
 * ---------------------------------------------------------
 * 1. Stable WiFi Connection
 * 2. MQTT Communication
 * 3. RFID Attendance Scan
 * 4. LCD Status Messages
 * 5. Auto Timeout Reset
 * 6. RFID Reinitialization
 * 7. Face Verification Flow
 * 8. Welcome & Thank You Messages
 * 9. Better RFID Detection Logic
 * 10. Auto Reconnect WiFi & MQTT
 * 11. TWO-WAY FEEDBACK LOGIC
 *
 * =========================================================
 */

#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// =========================================================
// WIFI CONFIG
// =========================================================

#define WIFI_SSID       "vivot2x"
#define WIFI_PASSWORD   "12345678900"

// =========================================================
// MQTT CONFIG
// =========================================================

const char* MQTT_BROKER = "broker.hivemq.com";
const int MQTT_PORT = 1883;

// MQTT Topics
const char* TOPIC_CMD      = "iot/node1/cmd";
const char* TOPIC_SCAN     = "iot/node1/scan";
const char* TOPIC_FEEDBACK = "iot/node1/feedback"; // NEW TOPIC FOR FEEDBACK

// =========================================================
// RFID PINS
// =========================================================

#define SS_PIN   D4
#define RST_PIN  D3

// =========================================================
// OBJECTS
// =========================================================

WiFiClient espClient;
PubSubClient client(espClient);

MFRC522 mfrc522(SS_PIN, RST_PIN);

LiquidCrystal_I2C lcd(0x27, 16, 2);

// =========================================================
// VARIABLES
// =========================================================

bool scanEnabled = false;
bool waitingForFeedback = false;

unsigned long scanStartTime = 0;
unsigned long feedbackStartTime = 0;
unsigned long lastMQTTAttempt = 0;

// =========================================================
// FUNCTION DECLARATIONS
// =========================================================

void setupWiFi();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void showStatus(String line1, String line2);
void idleScreen();
void bootScreen();

// =========================================================
// SETUP
// =========================================================

void setup() {

  Serial.begin(115200);

  // -------------------------------------------------------
  // WIFI SETTINGS
  // -------------------------------------------------------

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  // -------------------------------------------------------
  // LCD INIT
  // -------------------------------------------------------

  lcd.init();
  lcd.backlight();

  // -------------------------------------------------------
  // BOOT SCREEN
  // -------------------------------------------------------

  bootScreen();

  // -------------------------------------------------------
  // RFID INIT
  // -------------------------------------------------------

  SPI.begin();
  SPI.setFrequency(4000000);
  mfrc522.PCD_Init();
  delay(100);

  Serial.println("RFID Initialized");

  // -------------------------------------------------------
  // WIFI CONNECT
  // -------------------------------------------------------

  setupWiFi();

  // -------------------------------------------------------
  // MQTT SETUP
  // -------------------------------------------------------

  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setCallback(mqttCallback);

  idleScreen();
}

// =========================================================
// LOOP
// =========================================================

void loop() {

  // -------------------------------------------------------
  // WIFI CHECK
  // -------------------------------------------------------

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Lost");
    showStatus("WIFI LOST", "RECONNECTING");
    setupWiFi();
  }

  // -------------------------------------------------------
  // MQTT CHECK
  // -------------------------------------------------------

  if (!client.connected()) {
    if (millis() - lastMQTTAttempt > 5000) {
      lastMQTTAttempt = millis();
      reconnectMQTT();
    }
  }

  client.loop();

  // -------------------------------------------------------
  // WAITING FOR FEEDBACK STATE
  // -------------------------------------------------------
  if (waitingForFeedback) {
    // If the frontend doesn't respond within 5 seconds, timeout
    if (millis() - feedbackStartTime > 5000) {
      waitingForFeedback = false;
      scanEnabled = false;
      showStatus("SYSTEM TIMEOUT", "NO RESPONSE");
      delay(2000);
      idleScreen();
    }
    return; // Don't process new cards while waiting for feedback
  }

  // =======================================================
  // RFID SCAN LOGIC
  // =======================================================

  if (scanEnabled) {

    // -----------------------------------------------------
    // SCAN TIMEOUT
    // -----------------------------------------------------

    if (millis() - scanStartTime > 15000) {
      scanEnabled = false;
      showStatus("SCAN TIMEOUT", "TRY AGAIN");
      delay(2000);
      idleScreen();
      return;
    }

    // -----------------------------------------------------
    // BETTER RFID DETECTION
    // -----------------------------------------------------

    bool cardDetected = false;

    for (int i = 0; i < 3; i++) {
      if (mfrc522.PICC_IsNewCardPresent()) {
        if (mfrc522.PICC_ReadCardSerial()) {
          cardDetected = true;
          break;
        }
      }
      delay(50);
    }

    // -----------------------------------------------------
    // CARD FOUND
    // -----------------------------------------------------

    if (cardDetected) {

      String uid = "";

      for (byte i = 0; i < mfrc522.uid.size; i++) {
        if (mfrc522.uid.uidByte[i] < 0x10) {
          uid += "0";
        }
        uid += String(mfrc522.uid.uidByte[i], HEX);
      }

      uid.toUpperCase();

      Serial.println("Card UID: " + uid);

      // ---------------------------------------------------
      // VERIFYING
      // ---------------------------------------------------

      showStatus("VERIFYING", "ATTENDANCE...");
      delay(500);

      // ---------------------------------------------------
      // MQTT PUBLISH
      // ---------------------------------------------------

      bool success = client.publish(TOPIC_SCAN, uid.c_str());

      // ---------------------------------------------------
      // WAIT FOR FEEDBACK INSTEAD OF ASSUMING SUCCESS
      // ---------------------------------------------------

      if (success) {
        waitingForFeedback = true;
        feedbackStartTime = millis();
        Serial.println("UID Published. Waiting for Feedback...");
      } else {
        showStatus("UPLOAD FAILED", "TRY AGAIN");
        Serial.println("Publish Failed");
        delay(2000);
        scanEnabled = false;
        idleScreen();
      }

      // ---------------------------------------------------
      // STOP RFID
      // ---------------------------------------------------

      mfrc522.PICC_HaltA();
      mfrc522.PCD_StopCrypto1();

      // Reinitialize RFID
      mfrc522.PCD_Init();
    }
  }
}

// =========================================================
// WIFI CONNECTION
// =========================================================

void setupWiFi() {

  showStatus("CONNECT WIFI", "PLEASE WAIT");

  Serial.println();
  Serial.println("Connecting WiFi...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retry = 0;

  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  Serial.println();

  // -------------------------------------------------------
  // SUCCESS
  // -------------------------------------------------------

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi Connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());

    showStatus("WIFI CONNECTED", WiFi.localIP().toString());
    delay(2000);
  } else {
    Serial.println("WiFi Failed");
    showStatus("WIFI FAILED", "RESTARTING");
    delay(3000);
    ESP.restart();
  }
}

// =========================================================
// MQTT RECONNECT
// =========================================================

void reconnectMQTT() {

  showStatus("CONNECT MQTT", "PLEASE WAIT");
  Serial.println("Connecting MQTT...");

  // Unique Client ID
  String clientId = "ESP8266_" + String(ESP.getChipId());

  if (client.connect(clientId.c_str())) {
    Serial.println("MQTT Connected");
    
    client.subscribe(TOPIC_CMD);
    client.subscribe(TOPIC_FEEDBACK); // SUBSCRIBE TO FEEDBACK
    
    Serial.println("Subscribed");
    showStatus("MQTT CONNECTED", "SYSTEM READY");
    delay(2000);
    idleScreen();
  } else {
    Serial.print("MQTT Failed: ");
    Serial.println(client.state());

    showStatus("MQTT FAILED", "RETRYING");
    delay(2000);
  }
}

// =========================================================
// MQTT CALLBACK
// =========================================================

void mqttCallback(char* topic, byte* payload, unsigned int length) {

  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Message: ");
  Serial.println(message);

  // -------------------------------------------------------
  // START RFID SCAN (TRIGGER)
  // -------------------------------------------------------

  if (String(topic) == TOPIC_CMD) {
    if (message == "START_SCAN") {
      scanEnabled = true;
      waitingForFeedback = false; // Reset feedback flag
      scanStartTime = millis();

      showStatus("FACE VERIFIED", "TAP YOUR CARD");
      Serial.println("RFID Scan Enabled");
    }
  }

  // -------------------------------------------------------
  // FRONTEND FEEDBACK (SUCCESS OR FAIL)
  // -------------------------------------------------------

  if (String(topic) == TOPIC_FEEDBACK && waitingForFeedback) {
    
    if (message == "SUCCESS") {
      showStatus("ATTENDANCE", "SUCCESS");
      delay(2000);
      showStatus("WELCOME", "THANK YOU");
    } 
    else if (message == "FAIL") {
      showStatus("ATTENDANCE", "FAILED");
      delay(2000);
      showStatus("WRONG", "RFID CARD");
    } 
    else {
      showStatus("SYSTEM ERROR", "TRY AGAIN");
    }

    // Finished processing feedback
    delay(2000);
    waitingForFeedback = false;
    scanEnabled = false;
    idleScreen();
  }
}

// =========================================================
// BOOT SCREEN
// =========================================================

void bootScreen() {
  showStatus("SMART", "ATTENDANCE");
  delay(1500);
  showStatus("SYSTEM", "STARTING");
  delay(1500);
}

// =========================================================
// IDLE SCREEN
// =========================================================

void idleScreen() {
  showStatus("SYSTEM READY", "WAITING...");
}

// =========================================================
// LCD DISPLAY
// =========================================================

void showStatus(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
  Serial.println(line1 + " | " + line2);
}
