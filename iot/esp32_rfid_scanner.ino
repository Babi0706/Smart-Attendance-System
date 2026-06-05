/**
 * Smart Attendance RFID Scanner - ESP32 Firmware
 * 
 * Hardware:
 * - ESP32 DevKit
 * - RC522 RFID Reader
 * 
 * Pinout (RC522 to ESP32):
 * - SDA (SS) -> GPIO 5
 * - SCK      -> GPIO 18
 * - MOSI     -> GPIO 23
 * - MISO     -> GPIO 19
 * - IRQ      -> Not connected
 * - GND      -> GND
 * - RST      -> GPIO 22
 * - 3.3V     -> 3.3V
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <time.h>

// --- CONFIGURATION ---
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* SUPABASE_URL = "https://oezelkllavaxwxxlugpt.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y";
const char* NODE_ID = "IOT-01"; // Change per device location

// --- RC522 PINS ---
#define SS_PIN  5
#define RST_PIN 22
MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();

  Serial.println("\n--- Smart Attendance RFID Scanner ---");
  connectToWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  // Heartbeat every 30 seconds
  static unsigned long lastPing = 0;
  if (millis() - lastPing > 30000) {
    sendHeartbeat();
    lastPing = millis();
  }

  // Check for RFID scans
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    
    Serial.println("Card Scanned: " + uid);
    sendScanToSupabase(uid);

    // Halt RFID to prevent multiple reads
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Failed. Retrying in loop...");
  }
}

void sendScanToSupabase(String uid) {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/rfid_scans";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));

  String jsonPayload = "{\"uid\": \"" + uid + "\", \"node_id\": \"" + String(NODE_ID) + "\"}";
  
  Serial.println("Sending scan to Supabase...");
  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Error code: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void sendHeartbeat() {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/iot_nodes?id=eq." + String(NODE_ID);
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Prefer", "return=minimal");

  int signal = 100 + WiFi.RSSI(); // WiFi.RSSI() is negative
  if (signal < 0) signal = 0;
  if (signal > 100) signal = 100;

  String jsonPayload = "{\"status\": \"ONLINE\", \"signal_strength\": " + String(signal) + ", \"last_ping\": \"now()\"}";
  
  Serial.println("Sending heartbeat...");
  int httpResponseCode = http.PATCH(jsonPayload);
  http.end();
}
