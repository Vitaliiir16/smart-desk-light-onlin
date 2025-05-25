#include "led_control.h"

CRGB leds[NUM_LEDS];
LedConfiguration currentActiveConfig = {
  "default", "Тепле Біле (Статика)", 200, 0, "user_static", true,
  {{255, 165, 70}}, 1, 
  {3, true, 128, 0, FIRE_DEFAULT_COOLING, FIRE_DEFAULT_SPARKING, METEOR_DEFAULT_DECAY, METEOR_DEFAULT_SIZE, 20} 
};
bool isLedStripOn = true;

static unsigned long lastEffectUpdateMillis = 0;
static uint8_t effectStateCounter = 0; 
static byte heat[NUM_LEDS];
static bool gFireReverse = false; 
static int breathValue = 0;
static bool breathUp = true;
static uint8_t chaseOffset = 0;
static int meteorPos = 0;

extern const TProgmemRGBPalette16 ForestColors_p FL_PROGMEM;
extern const TProgmemRGBPalette16 PartyColors_p FL_PROGMEM;
const TProgmemRGBPalette16* effectPalettes[] = {
  &HeatColors_p, 
  &ForestColors_p, 
  &PartyColors_p,
  &RainbowColors_p, 
  &CloudColors_p    
};
const uint8_t numEffectPalettes = sizeof(effectPalettes) / sizeof(effectPalettes[0]);

void fillSolid(CRGB color) {
    if (NUM_LEDS == 0) return;
    for (int i = 0; i < NUM_LEDS; i++) { leds[i] = color; }
}

void fillGradient(const RgbColor* effectColors, uint8_t numColorsToUse) {
    if (NUM_LEDS == 0 || numColorsToUse == 0) { FastLED.clearData(); return; }
    if (numColorsToUse == 1) {
        fillSolid(CRGB(effectColors[0].r, effectColors[0].g, effectColors[0].b));
        return;
    }
    CRGBPalette16 currentPalette;
    if (numColorsToUse == 2) {
        currentPalette = CRGBPalette16(CRGB(effectColors[0].r, effectColors[0].g, effectColors[0].b), CRGB(effectColors[1].r, effectColors[1].g, effectColors[1].b));
    } else if (numColorsToUse == 3) {
        currentPalette = CRGBPalette16(
            CRGB(effectColors[0].r, effectColors[0].g, effectColors[0].b),
            CRGB(effectColors[1].r, effectColors[1].g, effectColors[1].b),
            CRGB(effectColors[2].r, effectColors[2].g, effectColors[2].b)
        );
    } else { 
        CRGB c[4];
        for(int i=0; i<4; i++) {
            if (i < numColorsToUse) c[i] = CRGB(effectColors[i].r, effectColors[i].g, effectColors[i].b);
            else c[i] = CRGB(effectColors[numColorsToUse-1].r, effectColors[numColorsToUse-1].g, effectColors[numColorsToUse-1].b); 
        }
        currentPalette = CRGBPalette16(c[0],c[1],c[2],c[3]);
    }
    uint8_t grad_delta = (NUM_LEDS > 1) ? (255 / (NUM_LEDS - 1)) : 0;
    if (grad_delta == 0 && NUM_LEDS > 1) grad_delta = 1;
    fill_palette(leds, NUM_LEDS, 0, grad_delta, currentPalette, 255, LINEARBLEND);
}

void setupLedStrip() {
  if (NUM_LEDS == 0) return;
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(currentActiveConfig.brightness);
  FastLED.clear(true);
}

void turnLedStripOff() {
  if (NUM_LEDS == 0) return;
  FastLED.clear(true);
}

void applyCurrentConfigToLeds() {
  if (NUM_LEDS == 0) return;
  if (!isLedStripOn) {
    turnLedStripOff();
    return;
  }
  FastLED.setBrightness(currentActiveConfig.brightness);
  effectStateCounter = 0; 
  breathValue = 0; breathUp = true;
  chaseOffset = 0;
  meteorPos = 0;
  if (NUM_LEDS > 0) { for(int i=0; i<NUM_LEDS; i++) { heat[i] = 0; } }

  String mode = currentActiveConfig.mode;

  if (mode == "user_static") {
    if (currentActiveConfig.num_colors > 0) {
      fillSolid(CRGB(currentActiveConfig.colors[0].r, currentActiveConfig.colors[0].g, currentActiveConfig.colors[0].b));
    } else FastLED.clearData();
  } else if (mode == "user_gradient") {
    if (currentActiveConfig.num_colors >= 2) {
      fillGradient(currentActiveConfig.colors, currentActiveConfig.num_colors);
    } else FastLED.clearData();
  } else if (mode == "user_breath" || mode == "user_twinkle") {
     // Початковий стан для цих режимів встановлюється в їх функціях оновлення
     FastLED.clearData(); // Почнемо з чистого
  } else { // Для всіх "effect_..." режимів
    FastLED.clearData(); 
  }
  FastLED.show();
}

void effect_user_static() {
  if (NUM_LEDS == 0 || currentActiveConfig.num_colors == 0) { FastLED.show(); return; }
  fillSolid(CRGB(currentActiveConfig.colors[0].r, currentActiveConfig.colors[0].g, currentActiveConfig.colors[0].b));
  FastLED.show();
}

void effect_user_gradient() {
    if (NUM_LEDS == 0 || currentActiveConfig.num_colors < 2) { FastLED.show(); return; }
    fillGradient(currentActiveConfig.colors, currentActiveConfig.num_colors);
    FastLED.show();
}

void effect_user_breath(uint8_t speed) {
  if (NUM_LEDS == 0 || currentActiveConfig.num_colors == 0) return;
  int step = map(speed, 0, 255, 1, 8); if (step == 0) step = 1;
  if (breathUp) {
    breathValue += step;
    if (breathValue >= 255) { breathValue = 255; breathUp = false; }
  } else {
    breathValue -= step;
    if (breathValue <= 0) { breathValue = 0; breathUp = true; }
  }
  CRGB color = CRGB(currentActiveConfig.colors[0].r, currentActiveConfig.colors[0].g, currentActiveConfig.colors[0].b);
  fill_solid(leds, NUM_LEDS, color.nscale8_video(breathValue));
  FastLED.show();
}

void effect_user_twinkle(uint8_t speed) {
    if (NUM_LEDS == 0) return;
    uint8_t fadeAmount = currentActiveConfig.params.twinkle_fade_speed;
    if (fadeAmount < 5 || fadeAmount > 50) fadeAmount = 20; // Обмеження
    
    fadeToBlackBy(leds, NUM_LEDS, fadeAmount); 

    uint8_t chance = map(speed, 0, 255, 1, max(1, NUM_LEDS / 4) ); 
    if (random8() < chance) {
        CRGB color;
        if (currentActiveConfig.num_colors > 0) {
            color = CRGB(currentActiveConfig.colors[0].r, currentActiveConfig.colors[0].g, currentActiveConfig.colors[0].b);
        } else {
            color = CRGB(CHSV(random8(), 255, 255)); // Повністю випадковий яскравий колір
        }
        uint8_t intensity = currentActiveConfig.params.intensity;
        if(intensity == 0) intensity = 255; // Максимальна яскравість зірки, якщо не задано
        leds[random16(NUM_LEDS)] = color.nscale8_video(intensity);
    }
    FastLED.show();
}

void effect_fire(uint8_t speed) {
    if (NUM_LEDS == 0) return;
    uint8_t cooling = currentActiveConfig.params.cooling;
    uint8_t sparking = currentActiveConfig.params.sparking;
    if (cooling == 0) cooling = FIRE_DEFAULT_COOLING; 
    if (sparking == 0) sparking = FIRE_DEFAULT_SPARKING;
    unsigned long fireDelay = map(speed, 0, 255, 100, 15); 
    static unsigned long lastFireMillis = 0;
    if (millis() - lastFireMillis >= fireDelay) {
        lastFireMillis = millis();
        for (int i = 0; i < NUM_LEDS; i++) heat[i] = qsub8(heat[i], random8(0, ((cooling * 10) / NUM_LEDS) + 2));
        for (int k = NUM_LEDS - 1; k >= 2; k--) heat[k] = (heat[k - 1] + heat[k - 2] + heat[k - 2]) / 3;
        if (random8() < sparking) {
            int y = random8(min(NUM_LEDS, 7));
            if (y < NUM_LEDS) heat[y] = qadd8(heat[y], random8(160, 255));
        }
        for (int j = 0; j < NUM_LEDS; j++) {
            leds[gFireReverse ? (NUM_LEDS - 1) - j : j] = ColorFromPalette(HeatColors_p, scale8(heat[j], 240));
        }
        FastLED.show();
    }
}

void effect_rainbow_cycle(uint8_t speed) {
  if (NUM_LEDS == 0) return;
  uint8_t cycleSpeed = map(speed, 0, 255, 1, 10); 
  effectStateCounter += cycleSpeed; 
  uint8_t deltaHue = 255 / (NUM_LEDS > 0 ? NUM_LEDS : 1); if (deltaHue == 0) deltaHue = 1;
  fill_rainbow(leds, NUM_LEDS, effectStateCounter, deltaHue);
  FastLED.show();
}

void effect_police(uint8_t speed) {
  if (NUM_LEDS == 0) return;
  static uint8_t policeState = 0; static unsigned long lastPoliceChange = 0;
  unsigned long policeInterval = map(speed, 0, 255, 250, 50); 
  CRGB color1 = CRGB::Red; CRGB color2 = CRGB::Blue;
  if(currentActiveConfig.num_colors >= 1 && !(currentActiveConfig.colors[0].r==0 && currentActiveConfig.colors[0].g==0 && currentActiveConfig.colors[0].b==0) ) 
    color1.setRGB(currentActiveConfig.colors[0].r, currentActiveConfig.colors[0].g, currentActiveConfig.colors[0].b);
  if(currentActiveConfig.num_colors >= 2 && !(currentActiveConfig.colors[1].r==0 && currentActiveConfig.colors[1].g==0 && currentActiveConfig.colors[1].b==0) ) 
    color2.setRGB(currentActiveConfig.colors[1].r, currentActiveConfig.colors[1].g, currentActiveConfig.colors[1].b);

  if (millis() - lastPoliceChange > policeInterval) { lastPoliceChange = millis(); policeState = (policeState + 1) % 4; }
  int half = NUM_LEDS / 2; if (half == 0 && NUM_LEDS > 0) half = 1; 
  if (policeState == 0) { for (int i=0; i<half; i++) leds[i]=color1; for (int i=half; i<NUM_LEDS; i++) leds[i]=CRGB::Black; }
  else if (policeState == 1) { FastLED.clearData(); }
  else if (policeState == 2) { for (int i=0; i<half; i++) leds[i]=CRGB::Black; for (int i=half; i<NUM_LEDS; i++) leds[i]=color2; }
  else { FastLED.clearData(); }
  FastLED.show();
}

void effect_palette_cycle(uint8_t speed) {
    if (NUM_LEDS == 0) return;
    uint8_t paletteId = currentActiveConfig.params.palette_id;
    if (paletteId >= numEffectPalettes) paletteId = 1 % numEffectPalettes; 
    const TProgmemRGBPalette16& currentPalette = *effectPalettes[paletteId];
    uint8_t cycleSpeed = map(speed, 0, 255, 1, 15); effectStateCounter += cycleSpeed; 
    uint8_t delta = 255 / (NUM_LEDS > 0 ? NUM_LEDS : 1); if(delta == 0) delta = 1;
    for (int i = 0; i < NUM_LEDS; i++) leds[i] = ColorFromPalette(currentPalette, effectStateCounter + i * delta, 255, LINEARBLEND);
    FastLED.show();
}

void effect_meteor(uint8_t speed) {
    if (NUM_LEDS == 0) return;
    uint8_t meteorDecay = currentActiveConfig.params.meteor_decay;
    uint8_t meteorSize = currentActiveConfig.params.meteor_size;
    if (meteorDecay == 0) meteorDecay = METEOR_DEFAULT_DECAY;
    if (meteorSize == 0) meteorSize = METEOR_DEFAULT_SIZE;
    if (meteorSize > NUM_LEDS) meteorSize = NUM_LEDS; if(meteorSize == 0) meteorSize = 1;
    for(int i = 0; i < NUM_LEDS; i++) if (random8(10) > 5) leds[i].fadeToBlackBy(meteorDecay);
    static unsigned long lastMeteorMove = 0;
    unsigned long meteorMoveInterval = map(speed, 0, 255, 80, 15);
    if(millis() - lastMeteorMove > meteorMoveInterval) { lastMeteorMove = millis(); meteorPos++; if (meteorPos > NUM_LEDS + meteorSize) meteorPos = 0; }
    CRGB meteorColor = (currentActiveConfig.num_colors > 0) ? CRGB(currentActiveConfig.colors[0].r, currentActiveConfig.colors[0].g, currentActiveConfig.colors[0].b) : CRGB::White;
    for (int j=0; j<meteorSize ; j++) if ((meteorPos-j>=0) && (meteorPos-j<NUM_LEDS)) leds[meteorPos-j] = meteorColor.nscale8_video(255-(j*(255/meteorSize)));
    FastLED.show();
    if (currentActiveConfig.mode != "effect_meteor") meteorPos = 0; 
}

void effect_segments_chase(uint8_t speed) {
    if (NUM_LEDS == 0 || currentActiveConfig.num_colors == 0) return;
    uint8_t numSegs = currentActiveConfig.params.segments;
    if (numSegs == 0 || numSegs > NUM_LEDS) numSegs = max(1, NUM_LEDS / 3); if (numSegs == 0) numSegs = 1;
    int segLen = NUM_LEDS / numSegs; if (segLen == 0) { segLen = 1; numSegs = NUM_LEDS; }
    uint8_t chaseDelay = map(speed, 0, 255, 200, 20); static unsigned long lastSegChase = 0;
    if (millis() - lastSegChase >= chaseDelay) {
        lastSegChase = millis();
        if(currentActiveConfig.params.direction_forward) chaseOffset = (chaseOffset + 1) % numSegs; 
        else chaseOffset = (chaseOffset == 0) ? (numSegs - 1) : (chaseOffset - 1);
    }
    for (int i=0; i<NUM_LEDS; i++) {
        int currentSeg = (i / segLen + chaseOffset) % numSegs;
        RgbColor c = currentActiveConfig.colors[currentSeg % currentActiveConfig.num_colors];
        leds[i] = CRGB(c.r, c.g, c.b);
    }
    FastLED.show();
}

void effect_fade_rgb_smooth(uint8_t speed) { 
    static uint8_t colorPhase = 0; static uint8_t blendVal = 0;
    uint8_t blendSpeed = map(speed, 0, 255, 1, 5); if(blendSpeed == 0) blendSpeed = 1;
    blendVal += blendSpeed; 
    if (blendVal < blendSpeed && blendVal != 0) { colorPhase = (colorPhase + 1) % 6; } // Перевірка переповнення
    CRGB c1, c2;
    switch (colorPhase) {
        case 0: c1=CRGB::Red; c2=CRGB::Yellow; break; case 1: c1=CRGB::Yellow; c2=CRGB::Green; break;
        case 2: c1=CRGB::Green; c2=CRGB::Cyan; break; case 3: c1=CRGB::Cyan; c2=CRGB::Blue; break;
        case 4: c1=CRGB::Blue; c2=CRGB::Magenta; break; default: c1=CRGB::Magenta; c2=CRGB::Red; break;
    }
    fill_solid(leds, NUM_LEDS, blend(c1, c2, blendVal));
    FastLED.show();
}

void effect_confetti(uint8_t speed) {
    if (NUM_LEDS == 0) return;
    uint8_t fadeBy = map(speed, 0, 255, 5, 30);
    fadeToBlackBy(leds, NUM_LEDS, fadeBy);
    uint8_t chance = map(speed, 0, 255, 1, 10);
    if (random8(chance) == 0) { 
        leds[random16(NUM_LEDS)] += CHSV(effectStateCounter + random8(64), 200, 255);
    }
    effectStateCounter++; 
    FastLED.show();
}

void effect_matrix(uint8_t speed) {
    if (NUM_LEDS == 0) return;
    uint8_t fadeAmt = map(speed, 0, 255, 20, 5); 
    for (int i = 0; i < NUM_LEDS; i++) leds[i].nscale8(255 - fadeAmt);
    uint8_t spawnChance = map(speed, 0, 255, 1, 10); 
    if (random8(spawnChance) == 0) {
        if (currentActiveConfig.num_colors > 0) {
            RgbColor c = currentActiveConfig.colors[0]; leds[0] = CRGB(c.r, c.g, c.b);
        } else leds[0] = CRGB::Green; 
    }
    for (int i = NUM_LEDS - 1; i > 0; i--) leds[i] = leds[i - 1];
    if(random8(10) < 2) leds[0] = CRGB::Black; 
    FastLED.show();
}

void updateLedEffects(unsigned long currentMillis) {
  if (!isLedStripOn || NUM_LEDS == 0) {
    if (NUM_LEDS == 0 && isLedStripOn) FastLED.clear(true);
    return;
  }
  bool readyForGeneralUpdate = (currentMillis - lastEffectUpdateMillis >= LED_EFFECT_UPDATE_INTERVAL);
  if (readyForGeneralUpdate) lastEffectUpdateMillis = currentMillis;
  
  String mode = currentActiveConfig.mode;
  uint8_t speed = currentActiveConfig.speed;

  if (mode == "user_static") { if(readyForGeneralUpdate) effect_user_static(); }
  else if (mode == "user_gradient") { if(readyForGeneralUpdate) effect_user_gradient(); }
  else if (mode == "user_breath") { if(readyForGeneralUpdate) effect_user_breath(speed); }
  else if (mode == "user_twinkle") { if(readyForGeneralUpdate) effect_user_twinkle(speed); }
  else if (mode == "effect_fire") { effect_fire(speed); } 
  else if (mode == "effect_rainbow_cycle") { if(readyForGeneralUpdate) effect_rainbow_cycle(speed); }
  else if (mode == "effect_police") { effect_police(speed); } 
  else if (mode == "effect_palette_cycle") { if(readyForGeneralUpdate) effect_palette_cycle(speed); } 
  else if (mode == "effect_meteor") { if(readyForGeneralUpdate) effect_meteor(speed); }
  else if (mode == "effect_segments_chase") { effect_segments_chase(speed); } 
  else if (mode == "effect_fade_rgb") { if(readyForGeneralUpdate) effect_fade_rgb_smooth(speed); } 
  else if (mode == "effect_matrix") { if(readyForGeneralUpdate) effect_matrix(speed); }
  else if (mode == "effect_confetti") { if(readyForGeneralUpdate) effect_confetti(speed); }
  else { 
      if(readyForGeneralUpdate && currentActiveConfig.num_colors > 0) {
           fill_solid(leds, NUM_LEDS, CRGB(currentActiveConfig.colors[0].r, currentActiveConfig.colors[0].g, currentActiveConfig.colors[0].b));
           FastLED.show();
      } else if (readyForGeneralUpdate) {
           FastLED.clearData(); FastLED.show();
      }
  }
}