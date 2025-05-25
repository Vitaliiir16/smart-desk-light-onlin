// Файл: SmartDeskLight/esp8266_firmware/network_communication.h

#ifndef NETWORK_COMMUNICATION_H
#define NETWORK_COMMUNICATION_H

void setupWiFiConnection();
void ensureWiFiConnected(unsigned long currentMillis);
void fetchActiveConfig(unsigned long currentMillis);
void fetchAllConfigIds(unsigned long currentMillis);
void activateConfigurationOnServer(String configId);

#endif // NETWORK_COMMUNICATION_H