# Smart Attendance IoT Setup

This folder contains the firmware for the ESP32-based RFID scanner.

## Hardware Components
- **ESP32 DevKit** (V1 or later)
- **RC522 RFID Reader**
- **RFID Tags/Cards** (13.56MHz)
- **Jumper Wires**

## Pinout Configuration
| RC522 Pin | ESP32 GPIO |
|-----------|------------|
| SDA (SS)  | GPIO 5      |
| SCK       | GPIO 18     |
| MOSI      | GPIO 23     |
| MISO      | GPIO 19     |
| IRQ       | N/C         |
| GND       | GND         |
| RST       | GPIO 22     |
| 3.3V      | 3.3V        |

## Software Setup
1. Install **Arduino IDE**.
2. Install the **ESP32 Board Support Package**:
   - Go to `File` > `Preferences`.
   - Add `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json` to "Additional Boards Manager URLs".
   - Go to `Tools` > `Board` > `Boards Manager` and install `esp32`.
3. Install the **MFRC522** library:
   - Go to `Sketch` > `Include Library` > `Manage Libraries`.
   - Search for `MFRC522` and install the one by **GithubCommunity**.
4. Open [esp32_rfid_scanner.ino](file:///c:/Users/dando/Downloads/Attendence/iot/esp32_rfid_scanner.ino).
5. Update `WIFI_SSID` and `WIFI_PASSWORD` with your network credentials.
6. Upload the code to your ESP32.

## How it Works
The ESP32 connects to your WiFi and continuously pings the Supabase database.
- **Heartbeat**: Every 30 seconds, it updates its status and signal strength in the `iot_nodes` table.
- **Scans**: When an RFID tag is detected, the UID is extracted and sent immediately to the `rfid_scans` table.
- **Integration**: The web application listens for new entries in `rfid_scans` via real-time subscriptions to verify students.
