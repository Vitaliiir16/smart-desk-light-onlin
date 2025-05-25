#ifndef CONFIG_H
#define CONFIG_H

static const char* WIFI_SSID = "NetojNet";
static const char* WIFI_PASSWORD = "ss18031970";
static const char* BACKEND_SERVER_IP = "192.168.0.179"; 
static const int BACKEND_SERVER_PORT = 3000;

static const int LED_PIN = 2;      
static const int BUTTON_PIN_ON_OFF = 0;   
static const int BUTTON_PIN_MODE_SWITCH = 4;

static const int NUM_LEDS = 30;    
static const int DEFAULT_BRIGHTNESS = 128; 
static const int MAX_EFFECT_COLORS = 5; 

static const uint8_t FIRE_DEFAULT_COOLING  = 55;
static const uint8_t FIRE_DEFAULT_SPARKING = 120;
static const uint8_t METEOR_DEFAULT_DECAY = 64;
static const uint8_t METEOR_DEFAULT_SIZE = 7;

static const unsigned long ALL_CONFIGS_FETCH_INTERVAL = 60000;
static const unsigned long CONFIG_FETCH_INTERVAL = 2000;
static const unsigned long WIFI_RECONNECT_INTERVAL = 15000; 
static const unsigned long LED_EFFECT_UPDATE_INTERVAL = 30;
static const unsigned long DEBOUNCE_DELAY_BUTTON = 50;      

#endif