![Logo](admin/fujitsu.png)

# ioBroker.fujitsu-airstage

[![NPM version](https://img.shields.io/npm/v/iobroker.fujitsu-airstage.svg)](https://www.npmjs.com/package/iobroker.fujitsu-airstage)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fujitsu-airstage.svg)](https://www.npmjs.com/package/iobroker.fujitsu-airstage)
![Number of Installations](https://iobroker.live/badges/fujitsu-airstage-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/fujitsu-airstage-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.fujitsu-airstage.png?downloads=true)](https://nodei.co/npm/iobroker.fujitsu-airstage/)

**Tests:** ![Test and Release](https://github.com/stefan5232/ioBroker.fujitsu-airstage/workflows/Test%20and%20Release/badge.svg)

## Fujitsu Airstage Adapter für ioBroker

Dieser Adapter ermöglicht die Steuerung von Fujitsu Airstage Klimaanlagen über ioBroker. Die Klimageräte müssen mit einem WiFi-Modul ausgestattet sein und im lokalen Netzwerk erreichbar sein.

**Disclaimer**: Dieser Adapter ist ein unabhängiges Community-Projekt und steht in keiner Verbindung zu Fujitsu Limited oder deren Tochtergesellschaften. "Fujitsu" und "Airstage" sind eingetragene Marken von Fujitsu Limited. Die Verwendung erfolgt ausschließlich zur Identifikation kompatibler Geräte.

### Funktionen

- **Vollständige Steuerung**: Ein-/Ausschalten, Temperatur, Betriebsmodus, Lüftergeschwindigkeit
- **Erweiterte Funktionen**: Powerful-Modus, Economy-Modus, Lamellenschwenkung (vertikal/horizontal)
- **Statusüberwachung**: Aktuelle Innen- und Außentemperatur, Stromverbrauch, Gerätestatus
- **Zusatzfunktionen**: WiFi-LED, Low-Noise-Modus, Human Detection, Energy Saving Fan
- **Mehrere Geräte**: Unterstützung für beliebig viele Klimaanlagen
- **Automatische Updates**: Konfigurierbares Abfrageintervall für Statusaktualisierungen

### Voraussetzungen

- Fujitsu Airstage Klimaanlage mit WiFi-Modul
- Die Klimaanlage muss im lokalen Netzwerk (LAN/WLAN) erreichbar sein
- IP-Adresse und Device ID (MAC-Adresse) der Klimaanlage

### Installation

1. Adapter über die ioBroker Admin-Oberfläche installieren
2. Alternativ: `npm install iobroker.fujitsu-airstage`

### Konfiguration

#### Device ID ermitteln

Die Device ID ist die MAC-Adresse des WiFi-Moduls **ohne Doppelpunkte**:
- Beispiel MAC-Adresse: `AA:BB:CC:DD:EE:FF`
- Device ID für den Adapter: `AABBCCDDEEFF`

Die MAC-Adresse finden Sie:
- In der Fujitsu-App (z.B. FGLair)
- Im Router unter verbundene Geräte
- Auf einem Aufkleber am WiFi-Modul

#### IP-Adresse ermitteln

Die IP-Adresse der Klimaanlage finden Sie:
- Im Router unter DHCP-Clients
- In der Fujitsu-App in den Gerätedetails

**Empfehlung**: Vergeben Sie im Router eine feste IP-Adresse (DHCP-Reservation) für die Klimaanlage.

#### Adapter-Einstellungen

1. Öffnen Sie die Adapter-Konfiguration in ioBroker
2. Fügen Sie ein oder mehrere Geräte hinzu:
   - **Name**: Frei wählbarer Name (z.B. "Wohnzimmer", "Schlafzimmer")
   - **IP-Adresse**: Lokale IP-Adresse der Klimaanlage (z.B. 192.168.1.100)
   - **Device ID**: MAC-Adresse ohne Doppelpunkte (z.B. AABBCCDDEEFF)
3. **Abfrageintervall**: Legt fest, wie oft der Status abgefragt wird (Standard: 30 Sekunden)
4. Einstellungen speichern und Instanz starten

### Datenpunkte

Für jedes konfigurierte Gerät werden folgende Datenpunkte erstellt:

#### Steuerung (beschreibbar)
| Datenpunkt | Typ | Beschreibung |
|------------|-----|--------------|
| `power` | boolean | Gerät ein-/ausschalten |
| `target_temperature` | number | Zieltemperatur (16-30°C) |
| `mode` | string | Betriebsmodus: auto, cool, heat, dry, fan |
| `fan_speed` | string | Lüftergeschwindigkeit: auto, quiet, low, medium, high |
| `swing_vertical` | boolean | Vertikale Lamellenschwenkung |
| `swing_horizontal` | boolean | Horizontale Lamellenschwenkung |
| `powerful` | boolean | Powerful-Modus (schnelles Heizen/Kühlen) |
| `economy` | boolean | Economy-Modus (Energiesparen) |
| `fan_ctrl` | boolean | Energy Saving Fan |
| `outdoor_low_noise` | boolean | Low-Noise-Modus für Außengerät |
| `wifi_led` | boolean | WiFi-LED ein/aus |
| `min_heat` | boolean | Minimum Heat Modus |

#### Status (nur lesbar)
| Datenpunkt | Typ | Beschreibung |
|------------|-----|--------------|
| `current_temperature` | number | Aktuelle Raumtemperatur |
| `outdoor_temperature` | number | Außentemperatur |
| `power_consumption` | number | Stromverbrauch in Watt |
| `vertical_direction` | string | Lamellenrichtung vertikal |
| `vertical_increments` | number | Vertikale Luftstrom-Schritte |
| `horizontal_direction` | number | Lamellenrichtung horizontal |
| `human_detection` | boolean | Personenerkennung aktiv |
| `online` | boolean | Gerät erreichbar |

### Bekannte Einschränkungen

- Die Fujitsu API limitiert die Anzahl der gleichzeitig abrufbaren Parameter auf ca. 20 Werte
- Der Parameter `iu_model` (Gerätemodell) wird derzeit nicht abgerufen, da dies die Anzahl der zurückgegebenen Werte stark reduziert

### Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 0.1.0 (2025-12-31)
* (Stefan Bott) initial release

## License

MIT License

Copyright (c) 2025-2026 Stefan Bott <stefan5232@gmx.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## English Version

### Fujitsu Airstage Adapter for ioBroker

This adapter enables control of Fujitsu Airstage air conditioners via ioBroker. The air conditioning units must be equipped with a WiFi module and be accessible in the local network.

**Disclaimer**: This adapter is an independent community project and is not affiliated with Fujitsu Limited or its subsidiaries. "Fujitsu" and "Airstage" are registered trademarks of Fujitsu Limited. Their use is solely for the purpose of identifying compatible devices.

### Features

- **Complete Control**: Power on/off, temperature, operation mode, fan speed
- **Advanced Functions**: Powerful mode, Economy mode, swing control (vertical/horizontal)
- **Status Monitoring**: Current indoor/outdoor temperature, power consumption, device status
- **Additional Functions**: WiFi LED, Low-Noise mode, Human Detection, Energy Saving Fan
- **Multiple Devices**: Support for unlimited number of air conditioners
- **Automatic Updates**: Configurable polling interval for status updates

### Requirements

- Fujitsu Airstage air conditioner with WiFi module
- Air conditioner must be accessible in the local network (LAN/WLAN)
- IP address and Device ID (MAC address) of the air conditioner

### Configuration

#### Finding the Device ID

The Device ID is the MAC address of the WiFi module **without colons**:
- Example MAC address: `AA:BB:CC:DD:EE:FF`
- Device ID for adapter: `AABBCCDDEEFF`

You can find the MAC address:
- In the Fujitsu app (e.g., FGLair)
- In your router's connected devices list
- On a sticker on the WiFi module

#### Finding the IP Address

You can find the air conditioner's IP address:
- In your router under DHCP clients
- In the Fujitsu app under device details

**Recommendation**: Assign a static IP address (DHCP reservation) for the air conditioner in your router.

### Troubleshooting

#### Device shows as offline
- Verify the IP address is correct
- Check if the air conditioner is reachable in the network (ping)
- Verify the Device ID is correct (12 hexadecimal characters)
- Ensure no firewall is blocking the connection

#### Commands are not executed
- Check the log for error messages
- Increase log level to "debug" for detailed information
- Ensure the air conditioner is not manually locked
