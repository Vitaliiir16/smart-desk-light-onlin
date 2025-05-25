#ifndef LED_CONTROL_H
#define LED_CONTROL_H

#include <FastLED.h>
#include "config.h"

extern CRGB leds[NUM_LEDS];

struct RgbColor {
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

struct EffectParams {
  uint8_t segments;
  bool    direction_forward;
  uint8_t intensity;
  uint8_t palette_id; 
  uint8_t cooling;    
  uint8_t sparking;   
  uint8_t meteor_decay;
  uint8_t meteor_size;
  uint8_t twinkle_fade_speed;
};

struct LedConfiguration {
  String id;
  String name;
  uint8_t brightness;
  uint8_t speed;
  String mode;
  bool isActive;
  RgbColor colors[MAX_EFFECT_COLORS];
  uint8_t num_colors;
  EffectParams params;
};

extern LedConfiguration currentActiveConfig;
extern bool isLedStripOn;

void setupLedStrip();
void applyCurrentConfigToLeds();
void turnLedStripOff();
void updateLedEffects(unsigned long currentMillis);

#endif