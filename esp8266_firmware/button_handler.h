#ifndef BUTTON_HANDLER_H
#define BUTTON_HANDLER_H

void setupButtonPins();
void handleOnOffButton(unsigned long currentMillis);
void handleModeSwitchButton(unsigned long currentMillis);

#endif