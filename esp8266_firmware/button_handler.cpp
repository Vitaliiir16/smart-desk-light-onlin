#include <Arduino.h>      
#include "button_handler.h"
#include "config.h"      
#include "led_control.h" 
#include "network_communication.h"

static int lastButtonOnOffState = HIGH;         
static unsigned long lastDebounceOnOffTime = 0;
static int currentButtonOnOffState = HIGH; 

static int lastButtonModeState = HIGH;         
static unsigned long lastDebounceModeTime = 0;
static int currentButtonModeState = HIGH; 

extern String configIds[50]; 
extern uint8_t numTotalConfigs; 
extern int currentConfigIndexOnESP; 

void setupButtonPins() {
  pinMode(BUTTON_PIN_ON_OFF, INPUT_PULLUP); 
  pinMode(BUTTON_PIN_MODE_SWITCH, INPUT_PULLUP);
}

void handleOnOffButton(unsigned long currentMillis) {
  int reading = digitalRead(BUTTON_PIN_ON_OFF);
  if (reading != lastButtonOnOffState) {
    lastDebounceOnOffTime = currentMillis;
  }
  if ((currentMillis - lastDebounceOnOffTime) > DEBOUNCE_DELAY_BUTTON) {
    if (reading != currentButtonOnOffState) { 
      currentButtonOnOffState = reading; 
      if (currentButtonOnOffState == LOW) {
        isLedStripOn = !isLedStripOn; 
        if (isLedStripOn) {
          applyCurrentConfigToLeds(); 
        } else {
          turnLedStripOff();
        }
      }
    }
  }
  lastButtonOnOffState = reading; 
}

void handleModeSwitchButton(unsigned long currentMillis) {
  int reading = digitalRead(BUTTON_PIN_MODE_SWITCH);
  if (reading != lastButtonModeState) {
    lastDebounceModeTime = currentMillis;
  }

  if ((currentMillis - lastDebounceModeTime) > DEBOUNCE_DELAY_BUTTON) {
    if (reading != currentButtonModeState) { 
      currentButtonModeState = reading;
      if (currentButtonModeState == LOW) {
        if (numTotalConfigs > 0) {
          currentConfigIndexOnESP = (currentConfigIndexOnESP + 1) % numTotalConfigs;
          if (currentConfigIndexOnESP < numTotalConfigs && currentConfigIndexOnESP >= 0) { // Додаткова перевірка
             String nextConfigId = configIds[currentConfigIndexOnESP];
             activateConfigurationOnServer(nextConfigId); 
          }
        }
      }
    }
  }
  lastButtonModeState = reading;
}