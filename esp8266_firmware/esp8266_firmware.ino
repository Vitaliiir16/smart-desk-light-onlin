#include <ESP8266WiFi.h>
#include "config.h"
#include "led_control.h"
#include "button_handler.h" 
#include "network_communication.h"

unsigned long currentGlobalMillis = 0;

void setup() {
  Serial.begin(115200);
  unsigned long serialStartWait = millis();
  while (!Serial && (millis() - serialStartWait < 2000)); 
  
  Serial.println("\n\n===================================");
  Serial.println(" ESP8266 Smart Desk Light (Dual Button)");
  Serial.println("        Starting system...");
  Serial.println("===================================");

  setupWiFiConnection();
  setupButtonPins(); 
  setupLedStrip();

  currentGlobalMillis = millis();
  if (WiFi.status() == WL_CONNECTED) {
    fetchAllConfigIds(currentGlobalMillis); 
    delay(200); 
    fetchActiveConfig(currentGlobalMillis);
  } else {
    applyCurrentConfigToLeds();
  }
  
  Serial.println("\nSetup complete. Entering loop.");
  Serial.println("===================================");
}

void loop() {
  currentGlobalMillis = millis();

  ensureWiFiConnected(currentGlobalMillis);
  fetchAllConfigIds(currentGlobalMillis); 
  fetchActiveConfig(currentGlobalMillis);
  
  handleOnOffButton(currentGlobalMillis);
  handleModeSwitchButton(currentGlobalMillis); 

  updateLedEffects(currentGlobalMillis);
}