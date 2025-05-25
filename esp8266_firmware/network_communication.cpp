#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include "network_communication.h"
#include "config.h"
#include "led_control.h"

static unsigned long lastConfigFetchMillis = 0;
static unsigned long lastWiFiReconnectAttemptMillis = 0;
static unsigned long lastAllConfigsFetchMillis = 0;

String configIds[50]; 
uint8_t numTotalConfigs = 0;
int currentConfigIndexOnESP = -1; 

void setupWiFiConnection() {
  Serial.println();
#ifdef MANUAL_WIFI_CONFIG
  String manual_ssid, manual_password;
  Serial.println("SSID:"); while (Serial.available() == 0) { delay(100); } manual_ssid = Serial.readStringUntil('\r'); manual_ssid.trim(); Serial.print("SSID: ["); Serial.print(manual_ssid); Serial.println("]"); while(Serial.read() >= 0){} 
  Serial.println("Password:"); while (Serial.available() == 0) { delay(100); } manual_password = Serial.readStringUntil('\r'); manual_password.trim(); Serial.println("Password received."); while(Serial.read() >= 0){}
  WiFi.begin(manual_ssid.c_str(), manual_password.c_str());
#else
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
#endif
  Serial.print("Connecting to Wi-Fi: "); Serial.println(WiFi.SSID());
  int attempt = 0; while (WiFi.status() != WL_CONNECTED && attempt < 60) { delay(500); Serial.print("."); attempt++; }
  if (WiFi.status() == WL_CONNECTED) { Serial.println("\nWi-Fi OK!"); Serial.print("IP: "); Serial.println(WiFi.localIP()); }
  else { Serial.println("\nWi-Fi FAILED."); }
}

void ensureWiFiConnected(unsigned long currentMillis) {
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastWiFiReconnectAttemptMillis >= WIFI_RECONNECT_INTERVAL) {
      lastWiFiReconnectAttemptMillis = currentMillis; Serial.println("Wi-Fi lost. Reconnecting...");
      WiFi.disconnect(); delay(100); setupWiFiConnection();
    }
  }
}

void fetchActiveConfig(unsigned long currentMillis) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (currentMillis - lastConfigFetchMillis >= CONFIG_FETCH_INTERVAL || lastConfigFetchMillis == 0) {
    unsigned long requestStartTime = millis();
    HTTPClient http; WiFiClient client; 
    String serverUrl = "http://" + String(BACKEND_SERVER_IP) + ":" + String(BACKEND_SERVER_PORT) + "/api/configurations/active";
    
    if (http.begin(client, serverUrl)) { 
      int httpCode = http.GET();
      if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        StaticJsonDocument<2048> doc; 
        DeserializationError error = deserializeJson(doc, payload);
        if (error) { Serial.print("deserializeJson() failed: "); Serial.println(error.c_str()); }
        else {
          LedConfiguration newConfig; bool configChanged = false; 
          newConfig.id = doc["id"].as<String>();
          newConfig.name = doc["name"].as<String>();
          newConfig.brightness = doc["brightness"] | DEFAULT_BRIGHTNESS;
          newConfig.speed = doc["speed"] | 100;
          newConfig.mode = doc["mode"].as<String>(); if (newConfig.mode == "") newConfig.mode = "user_static";
          newConfig.isActive = doc["isActive"] | true;
          JsonArray jsonColors = doc["colors"]; newConfig.num_colors = 0;
          if (jsonColors) {
            for (JsonObject c_obj : jsonColors) {
              if (newConfig.num_colors < MAX_EFFECT_COLORS) { 
                newConfig.colors[newConfig.num_colors].r = c_obj["r"] | 0;
                newConfig.colors[newConfig.num_colors].g = c_obj["g"] | 0;
                newConfig.colors[newConfig.num_colors].b = c_obj["b"] | 0;
                newConfig.num_colors++;
              } else break;
            }
          }
          if (newConfig.num_colors == 0) { newConfig.colors[0] = {255,255,255}; newConfig.num_colors = 1; }
          JsonObject paramsObj = doc["params"];
          newConfig.params = {3, true, 128, 0, FIRE_DEFAULT_COOLING, FIRE_DEFAULT_SPARKING, METEOR_DEFAULT_DECAY, METEOR_DEFAULT_SIZE, 20};
          if (paramsObj) { 
              newConfig.params.segments = paramsObj["segments"] | newConfig.params.segments;
              if (paramsObj["direction"].is<const char*>()) { newConfig.params.direction_forward = (strcmp(paramsObj["direction"], "forward") == 0); }
              else { newConfig.params.direction_forward = paramsObj["direction_forward"] | newConfig.params.direction_forward; }
              newConfig.params.intensity = paramsObj["intensity"] | newConfig.params.intensity;
              newConfig.params.palette_id = paramsObj["palette_id"] | newConfig.params.palette_id;
              newConfig.params.cooling = paramsObj["cooling"] | newConfig.params.cooling;
              newConfig.params.sparking = paramsObj["sparking"] | newConfig.params.sparking;
              newConfig.params.meteor_decay = paramsObj["meteor_decay"] | newConfig.params.meteor_decay;
              newConfig.params.meteor_size = paramsObj["meteor_size"] | newConfig.params.meteor_size;
              newConfig.params.twinkle_fade_speed = paramsObj["twinkle_fade_speed"] | newConfig.params.twinkle_fade_speed;
          }
          if (currentActiveConfig.id == "default" || newConfig.id != currentActiveConfig.id || newConfig.mode != currentActiveConfig.mode ||
              newConfig.brightness != currentActiveConfig.brightness || newConfig.speed != currentActiveConfig.speed ||
              newConfig.num_colors != currentActiveConfig.num_colors ) { configChanged = true; }
          if (!configChanged && newConfig.num_colors > 0 && currentActiveConfig.num_colors > 0) {
             for (uint8_t i=0; i<newConfig.num_colors; i++) { if (i < currentActiveConfig.num_colors && (newConfig.colors[i].r != currentActiveConfig.colors[i].r || newConfig.colors[i].g != currentActiveConfig.colors[i].g || newConfig.colors[i].b != currentActiveConfig.colors[i].b)) { configChanged=true; break; } }
          }
          if (!configChanged) { if(memcmp(&newConfig.params, &currentActiveConfig.params, sizeof(EffectParams)) != 0) configChanged = true; }
          
          if (configChanged || lastConfigFetchMillis == 0) { 
            currentActiveConfig = newConfig;
            applyCurrentConfigToLeds(); 
             // Оновлюємо currentConfigIndexOnESP, якщо ID змінився
            for(uint8_t i=0; i < numTotalConfigs; i++) {
                if (configIds[i] == currentActiveConfig.id) {
                    currentConfigIndexOnESP = i;
                    break;
                }
            }
          }
        }
      } else { Serial.printf("[HTTP] GET error: %d\n", httpCode); }
      http.end();
    } else { Serial.printf("[HTTP] Unable to connect\n"); }
    lastConfigFetchMillis = requestStartTime; 
  }
}

void fetchAllConfigIds(unsigned long currentMillis) {
    if (WiFi.status() != WL_CONNECTED) return;
    if (currentMillis - lastAllConfigsFetchMillis >= ALL_CONFIGS_FETCH_INTERVAL || lastAllConfigsFetchMillis == 0) {
        lastAllConfigsFetchMillis = currentMillis;
        HTTPClient http; WiFiClient client;
        String serverUrl = "http://" + String(BACKEND_SERVER_IP) + ":" + String(BACKEND_SERVER_PORT) + "/api/configurations";
        Serial.print("Fetching all config IDs from: "); Serial.println(serverUrl);

        if (http.begin(client, serverUrl)) {
            int httpCode = http.GET();
            if (httpCode == HTTP_CODE_OK) {
                String payload = http.getString();
                StaticJsonDocument<4096> doc; // Збільшити, якщо багато конфігурацій
                DeserializationError error = deserializeJson(doc, payload);
                if (error) {
                    Serial.print("fetchAllConfigIds - deserializeJson() failed: "); Serial.println(error.c_str());
                } else {
                    JsonArray array = doc.as<JsonArray>();
                    if (array) {
                        numTotalConfigs = 0;
                        for (JsonObject obj : array) {
                            if (numTotalConfigs < 50) { // Обмеження масиву configIds
                                String id = obj["id"].as<String>();
                                configIds[numTotalConfigs++] = id;
                                if (obj["isActive"] == true) {
                                    currentConfigIndexOnESP = numTotalConfigs - 1;
                                }
                            } else break;
                        }
                        Serial.print("Fetched "); Serial.print(numTotalConfigs); Serial.println(" config IDs.");
                        if (currentConfigIndexOnESP == -1 && numTotalConfigs > 0) currentConfigIndexOnESP = 0; // Якщо активна не знайдена, встановити першу
                    }
                }
            } else {
                Serial.printf("[HTTP] fetchAllConfigIds GET error: %d\n", httpCode);
            }
            http.end();
        } else {
            Serial.printf("[HTTP] fetchAllConfigIds unable to connect\n");
        }
    }
}

void activateConfigurationOnServer(String configId) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Cannot activate config, WiFi not connected.");
        return;
    }
    if (configId == "") {
        Serial.println("Cannot activate config, empty ID.");
        return;
    }

    HTTPClient http; WiFiClient client;
    String serverUrl = "http://" + String(BACKEND_SERVER_IP) + ":" + String(BACKEND_SERVER_PORT) + "/api/configurations/activate/" + configId;
    Serial.print("Activating config on server: "); Serial.println(serverUrl);

    if (http.begin(client, serverUrl)) {
        http.addHeader("Content-Type", "application/json"); // Хоча для цього PUT тіло не потрібне
        int httpCode = http.PUT(""); // Порожнє тіло для PUT запиту
        if (httpCode > 0) {
            Serial.printf("[HTTP] Activate PUT code: %d\n", httpCode);
            if (httpCode == HTTP_CODE_OK) {
                String payload = http.getString();
                Serial.println("Server response for activation:"); Serial.println(payload);
                // Негайно викликаємо fetchActiveConfig, щоб оновити локальний стан
                // Скидаємо таймер, щоб fetchActiveConfig спрацював наступного разу в loop()
                lastConfigFetchMillis = 0; 
            } else {
                Serial.println("Failed to activate config on server.");
            }
        } else {
            Serial.printf("[HTTP] Activate PUT failed, error: %s\n", http.errorToString(httpCode).c_str());
        }
        http.end();
    } else {
        Serial.printf("[HTTP] Activate unable to connect\n");
    }
}