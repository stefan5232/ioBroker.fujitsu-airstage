"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_axios = __toESM(require("axios"));
class FujitsuAirstage extends utils.Adapter {
  devices = [];
  updateInterval = null;
  constructor(options = {}) {
    super({
      ...options,
      name: "fujitsu-airstage"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  // Getter für typisierte Konfiguration
  get typedConfig() {
    return this.config;
  }
  async onReady() {
    this.log.info("Fujitsu Airstage adapter started");
    await this.setObjectNotExistsAsync("info", {
      type: "channel",
      common: {
        name: "Information"
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("info.connection", {
      type: "state",
      common: {
        name: " Device or service connected",
        type: "boolean",
        role: "indicator.connected",
        read: true,
        write: false
      },
      native: {}
    });
    const devices = this.typedConfig.devices || [];
    if (devices.length === 0) {
      this.log.warn("No devices configured");
      await this.setState("info.connected", false, true);
      return;
    }
    for (const deviceConfig of devices) {
      await this.initDevice(deviceConfig);
    }
    await this.setState("info.connection", true, true);
    this.startPolling();
    this.subscribeStates("*");
  }
  async initDevice(deviceConfig) {
    const { name, ip, deviceId } = deviceConfig;
    if (!ip || !deviceId) {
      this.log.error(`Device ${name}: IP or Device ID missing`);
      return;
    }
    if (!/^[A-Fa-f0-9]{12}$/.test(deviceId)) {
      this.log.error(`Device ${name}: Invalid Device ID format. Must be 12 hex characters (MAC without colons)`);
      return;
    }
    const deviceObj = {
      name,
      ip,
      deviceId: deviceId.toUpperCase(),
      baseUrl: `http://${ip}`
    };
    this.devices.push(deviceObj);
    await this.setObjectNotExistsAsync(deviceId, {
      type: "device",
      common: {
        name: name || `Fujitsu ${deviceId}`
      },
      native: deviceConfig
    });
    await this.createStates(deviceId);
    await this.updateDeviceData(deviceObj);
    this.log.info(`Device ${name} (${deviceId}) initialized`);
  }
  async createStates(deviceId) {
    const states = [
      {
        id: "power",
        name: "Power On/Off",
        type: "boolean",
        role: "switch.power",
        write: true
      },
      {
        id: "target_temperature",
        name: "Target Temperature",
        type: "number",
        role: "level.temperature",
        unit: "\xB0C",
        min: 16,
        max: 30,
        write: true
      },
      {
        id: "current_temperature",
        name: "Current Temperature",
        type: "number",
        role: "value.temperature",
        unit: "\xB0C",
        write: false
      },
      {
        id: "outdoor_temperature",
        name: "Outdoor Temperature",
        type: "number",
        role: "value.temperature",
        unit: "\xB0C",
        write: false
      },
      {
        id: "mode",
        name: "Operation Mode",
        type: "string",
        role: "text",
        states: {
          "auto": "Auto",
          "cool": "Cool",
          "heat": "Heat",
          "dry": "Dry",
          "fan": "Fan Only"
        },
        write: true
      },
      {
        id: "fan_speed",
        name: "Fan Speed",
        type: "string",
        role: "text",
        states: {
          "auto": "Auto",
          "quiet": "Quiet",
          "low": "Low",
          "medium": "Medium",
          "high": "High"
        },
        write: true
      },
      {
        id: "swing_vertical",
        name: "Vertical Swing",
        type: "boolean",
        role: "switch",
        write: true
      },
      {
        id: "swing_horizontal",
        name: "Horizontal Swing",
        type: "boolean",
        role: "switch",
        write: true
      },
      {
        id: "model",
        // wird aktuell nicht mit abgerufen
        name: "Device Model",
        type: "string",
        role: "info.name",
        write: false
      },
      {
        id: "powerful",
        name: "Powerful Mode",
        type: "boolean",
        role: "switch",
        write: true
      },
      {
        id: "economy",
        name: "Economy Mode",
        type: "boolean",
        role: "switch",
        write: true
      },
      {
        id: "fan_ctrl",
        name: "Energy Saving Fan",
        type: "boolean",
        role: "switch",
        write: true
      },
      {
        id: "power_consumption",
        name: "Power Consumption",
        type: "number",
        role: "value.power.consumption",
        unit: "W",
        write: false
      },
      {
        id: "vertical_increments",
        name: "Vertical Air Flow Increments",
        type: "number",
        role: "value",
        write: false
      },
      {
        id: "vertical_direction",
        name: "Vertical Air Flow Direction",
        type: "string",
        role: "text",
        states: {
          "highest": "Highest",
          "high": "High",
          "low": "low",
          "lowest": "lowest"
        },
        write: false
      },
      {
        id: "horizontal_direction",
        name: "Horizontal Air Flow Direction",
        type: "number",
        role: "value",
        write: false
      },
      {
        id: "human_detection",
        name: "Human Detection",
        type: "boolean",
        role: "sensor",
        write: false
      },
      {
        id: "human_detection_auto_save",
        name: "Human Detection Auto Save",
        type: "boolean",
        role: "switch",
        write: false
      },
      {
        id: "outdoor_low_noise",
        name: "Outdoor Unit Low Noise",
        type: "boolean",
        role: "switch",
        write: true
      },
      {
        id: "wifi_led",
        name: "WiFi LED",
        type: "boolean",
        role: "switch",
        write: true
      },
      {
        id: "min_heat",
        name: "Minimum Heat",
        type: "boolean",
        role: "switch",
        write: true
      },
      {
        id: "online",
        name: "Device Online",
        type: "boolean",
        role: "indicator.reachable",
        write: false
      }
    ];
    for (const state of states) {
      const common = {
        name: state.name,
        type: state.type,
        role: state.role,
        read: true,
        write: state.write || false,
        ...state.unit && { unit: state.unit },
        ...state.min !== void 0 && { min: state.min },
        ...state.max !== void 0 && { max: state.max },
        ...state.states && { states: state.states }
      };
      await this.setObjectNotExistsAsync(`${deviceId}.${state.id}`, {
        type: "state",
        common,
        native: {}
      });
    }
  }
  async updateDeviceData(device) {
    var _a, _b;
    const payload = {
      device_id: device.deviceId,
      device_sub_id: 0,
      req_id: "",
      modified_by: "",
      set_level: "03",
      list: [
        //'iu_model',
        "iu_onoff",
        "iu_op_mode",
        "iu_fan_spd",
        "iu_powerful",
        "iu_economy",
        "iu_fan_ctrl",
        "iu_set_tmp",
        "iu_indoor_tmp",
        "iu_outdoor_tmp",
        "iu_pow_cons",
        "iu_af_swg_vrt",
        "iu_af_inc_vrt",
        "iu_af_dir_vrt",
        "iu_af_dir_hrz",
        "iu_af_swg_hrz",
        "iu_hmn_det",
        "iu_hmn_det_auto_save",
        "ou_low_noise",
        "iu_wifi_led",
        "iu_min_heat"
      ]
    };
    try {
      const response = await import_axios.default.post(
        `${device.baseUrl}/GetParam`,
        payload,
        {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 5e3
        }
      );
      if (response.data && response.data.result === "OK" && response.data.value) {
        const data = response.data.value;
        await this.setState(`${device.deviceId}.online`, true, true);
        if (data.iu_onoff !== void 0) {
          await this.setState(`${device.deviceId}.power`, parseInt(String(data.iu_onoff)) === 1, true);
        }
        if (data.iu_op_mode !== void 0) {
          await this.setState(`${device.deviceId}.mode`, this.mapMode(parseInt(String(data.iu_op_mode))), true);
        }
        if (data.iu_fan_spd !== void 0) {
          await this.setState(`${device.deviceId}.fan_speed`, this.mapFanSpeed(parseInt(String(data.iu_fan_spd))), true);
        }
        if (data.iu_powerful !== void 0) {
          await this.setState(`${device.deviceId}.powerful`, parseInt(String(data.iu_powerful)) === 1, true);
        }
        if (data.iu_economy !== void 0) {
          await this.setState(`${device.deviceId}.economy`, parseInt(String(data.iu_economy)) === 1, true);
        }
        if (data.iu_fan_ctrl !== void 0) {
          await this.setState(`${device.deviceId}.fan_ctrl`, parseInt(String(data.iu_fan_ctrl)) === 1, true);
        }
        if (data.iu_set_tmp !== void 0) {
          await this.setState(`${device.deviceId}.target_temperature`, parseInt(String(data.iu_set_tmp)) / 10, true);
        }
        if (data.iu_indoor_tmp !== void 0) {
          await this.setState(`${device.deviceId}.current_temperature`, (parseInt(String(data.iu_indoor_tmp)) - 5e3) / 100, true);
        }
        if (data.iu_outdoor_tmp !== void 0) {
          await this.setState(`${device.deviceId}.outdoor_temperature`, (parseInt(String(data.iu_outdoor_tmp)) - 5e3) / 100, true);
        }
        if (data.iu_pow_cons !== void 0) {
          await this.setState(`${device.deviceId}.power_consumption`, parseFloat(String(data.iu_pow_cons)), true);
        }
        if (data.iu_af_swg_vrt !== void 0) {
          await this.setState(`${device.deviceId}.swing_vertical`, parseInt(String(data.iu_af_swg_vrt)) === 1, true);
        }
        if (data.iu_af_inc_vrt !== void 0) {
          await this.setState(`${device.deviceId}.vertical_increments`, parseInt(String(data.iu_af_inc_vrt)), true);
        }
        if (data.iu_af_dir_vrt !== void 0) {
          await this.setState(`${device.deviceId}.vertical_direction`, this.mapVerticalDirection(parseInt(String(data.iu_af_dir_vrt))), true);
        }
        if (data.iu_af_dir_hrz !== void 0) {
          await this.setState(`${device.deviceId}.horizontal_direction`, parseInt(String(data.iu_af_dir_hrz)), true);
        }
        if (data.iu_af_swg_hrz !== void 0) {
          await this.setState(`${device.deviceId}.swing_horizontal`, parseInt(String(data.iu_af_swg_hrz)) === 1, true);
        }
        if (data.iu_hmn_det !== void 0) {
          await this.setState(`${device.deviceId}.human_detection`, parseInt(String(data.iu_hmn_det)) === 1, true);
        }
        if (data.iu_hmn_det_auto_save !== void 0) {
          await this.setState(`${device.deviceId}.human_detection_auto_save`, parseInt(String(data.iu_hmn_det_auto_save)) === 1, true);
        }
        if (data.ou_low_noise !== void 0) {
          await this.setState(`${device.deviceId}.outdoor_low_noise`, parseInt(String(data.ou_low_noise)) === 1, true);
        }
        if (data.iu_wifi_led !== void 0) {
          await this.setState(`${device.deviceId}.wifi_led`, parseInt(String(data.iu_wifi_led)) === 1, true);
        }
        if (data.iu_min_heat !== void 0) {
          await this.setState(`${device.deviceId}.min_heat`, parseInt(String(data.iu_min_heat)) === 1, true);
        }
      } else {
        this.log.warn(`No data received from device ${device.name} or error code: ${((_a = response.data) == null ? void 0 : _a.error) || ((_b = response.data) == null ? void 0 : _b.result)}`);
        this.log.debug(`BaseUrl: ${device.baseUrl}/GetParam -- Payload: ${JSON.stringify(payload)}`);
        this.log.debug(`Response-Data: ${JSON.stringify(response.data)}`);
        await this.setState(`${device.deviceId}.online`, false, true);
      }
    } catch (error) {
      this.log.error(`Error updating device ${device.name}: ${error instanceof Error ? error.message : String(error)}`);
      this.log.debug(`BaseUrl: ${device.baseUrl}/GetParam -- Payload: ${JSON.stringify(payload)}`);
      await this.setState(`${device.deviceId}.online`, false, true);
    }
  }
  async onStateChange(id, state) {
    if (!state || state.ack) return;
    const parts = id.split(".");
    if (parts.length < 4) return;
    const deviceId = parts[2];
    const stateName = parts[3];
    const device = this.devices.find((d) => d.deviceId === deviceId);
    if (!device) {
      this.log.error(`Device ${deviceId} not found`);
      return;
    }
    try {
      await this.sendCommand(device, stateName, state.val);
      await this.setState(id, state.val, true);
      this.log.debug(`Command sent to ${device.name}: ${stateName} = ${state.val}`);
    } catch (error) {
      this.log.error(`Error sending command to ${device.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async sendCommand(device, command, value) {
    let paramName;
    let paramValue;
    switch (command) {
      case "power":
        paramName = "iu_onoff";
        paramValue = value ? 1 : 0;
        break;
      case "target_temperature":
        const temp = parseInt(String(value));
        if (temp >= 16 && temp <= 30) {
          paramName = "iu_set_tmp";
          paramValue = temp * 10;
        } else {
          throw new Error(`Invalid temperature: ${temp}. Must be between 16-30\xB0C`);
        }
        break;
      case "mode":
        paramName = "iu_op_mode";
        paramValue = this.mapModeReverse(String(value));
        break;
      case "fan_speed":
        paramName = "iu_fan_spd";
        paramValue = this.mapFanSpeedReverse(String(value));
        break;
      case "swing_vertical":
        paramName = "iu_af_swg_vrt";
        paramValue = value ? 1 : 0;
        break;
      case "swing_horizontal":
        paramName = "iu_af_swg_hrz";
        paramValue = value ? 1 : 0;
        break;
      case "powerful":
        paramName = "iu_powerful";
        paramValue = value ? 1 : 0;
        break;
      case "economy":
        paramName = "iu_economy";
        paramValue = value ? 1 : 0;
        break;
      case "fan_ctrl":
        paramName = "iu_fan_ctrl";
        paramValue = value ? 1 : 0;
        break;
      case "outdoor_low_noise":
        paramName = "ou_low_noise";
        paramValue = value ? 1 : 0;
        break;
      case "wifi_led":
        paramName = "iu_wifi_led";
        paramValue = value ? 1 : 0;
        break;
      case "min_heat":
        paramName = "iu_min_heat";
        paramValue = value ? 1 : 0;
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    const payload = {
      device_id: device.deviceId,
      device_sub_id: 0,
      req_id: "",
      modified_by: "",
      set_level: "02",
      value: { [paramName]: String(paramValue) }
    };
    const response = await import_axios.default.post(`${device.baseUrl}/SetParam`, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 5e3
    });
    if (response.data && response.data.result !== "OK") {
      this.log.debug(`BaseUrl: ${device.baseUrl}/GetParam -- Payload: ${JSON.stringify(payload)}`);
      throw new Error(`Command failed: ${response.data.error || response.data.result}`);
    }
    setTimeout(() => this.updateDeviceData(device), 1e3);
  }
  mapMode(mode) {
    const modes = {
      0: "auto",
      1: "cool",
      2: "dry",
      3: "fan",
      4: "heat"
    };
    return modes[mode] || "auto";
  }
  mapModeReverse(mode) {
    const modes = {
      "auto": 0,
      "cool": 1,
      "dry": 2,
      "fan": 3,
      "heat": 4
    };
    return modes[mode] || 0;
  }
  mapFanSpeed(speed) {
    const speeds = {
      0: "auto",
      1: "quiet",
      2: "low",
      3: "medium",
      4: "high"
    };
    return speeds[speed] || "auto";
  }
  mapFanSpeedReverse(speed) {
    const speeds = {
      "auto": 0,
      "quiet": 1,
      "low": 2,
      "medium": 3,
      "high": 4
    };
    return speeds[speed] || 0;
  }
  mapVerticalDirection(direction) {
    const directions = {
      1: "highest",
      2: "high",
      3: "lowest",
      4: "low"
    };
    return directions[direction] || "highest";
  }
  startPolling() {
    const interval = (this.typedConfig.pollInterval || 30) * 1e3;
    this.updateInterval = setInterval(async () => {
      for (const device of this.devices) {
        await this.updateDeviceData(device);
      }
    }, interval);
    this.log.info(`Started polling with ${interval / 1e3}s interval for ${this.devices.length} device(s)`);
  }
  onUnload(callback) {
    try {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      this.setState("info.connection", false, true);
      this.log.info("Fujitsu Airstage adapter stopped");
      callback();
    } catch (e) {
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new FujitsuAirstage(options);
} else {
  (() => new FujitsuAirstage())();
}
//# sourceMappingURL=main.js.map
