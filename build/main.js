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
    const devices = this.typedConfig.devices || [];
    if (devices.length === 0) {
      this.log.warn("No devices configured");
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
    try {
      const response = await import_axios.default.get(`${device.baseUrl}/ws.cgi`, {
        params: {
          cmd: "get_device_status",
          dsn: device.deviceId
        },
        timeout: 5e3
      });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const data = response.data[0];
        await this.setState(`${device.deviceId}.online`, true, true);
        await this.setState(`${device.deviceId}.power`, data.power === 1 || data.iu_onoff === 1, true);
        await this.setState(`${device.deviceId}.target_temperature`, data.iu_set_tmp || 20, true);
        await this.setState(`${device.deviceId}.current_temperature`, data.iu_indoor_tmp || 0, true);
        await this.setState(`${device.deviceId}.mode`, this.mapMode(data.iu_op_mode), true);
        await this.setState(`${device.deviceId}.fan_speed`, this.mapFanSpeed(data.iu_fan_spd), true);
        await this.setState(`${device.deviceId}.swing_vertical`, data.iu_af_dir_vrt === 1, true);
        await this.setState(`${device.deviceId}.swing_horizontal`, data.iu_af_dir_hrz === 1, true);
        this.log.debug(`Updated data for device ${device.name}: Power=${data.power}, Temp=${data.iu_set_tmp}\xB0C`);
      } else {
        this.log.warn(`No data received from device ${device.name}`);
        await this.setState(`${device.deviceId}.online`, false, true);
      }
    } catch (error) {
      this.log.error(`Error updating device ${device.name}: ${error instanceof Error ? error.message : String(error)}`);
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
    const params = {
      cmd: "set_device_status",
      dsn: device.deviceId
    };
    switch (command) {
      case "power":
        params.iu_onoff = value ? 1 : 0;
        break;
      case "target_temperature":
        const temp = parseInt(String(value));
        if (temp >= 16 && temp <= 30) {
          params.iu_set_tmp = temp;
        } else {
          throw new Error(`Invalid temperature: ${temp}. Must be between 16-30\xB0C`);
        }
        break;
      case "mode":
        params.iu_op_mode = this.mapModeReverse(String(value));
        break;
      case "fan_speed":
        params.iu_fan_spd = this.mapFanSpeedReverse(String(value));
        break;
      case "swing_vertical":
        params.iu_af_dir_vrt = value ? 1 : 0;
        break;
      case "swing_horizontal":
        params.iu_af_dir_hrz = value ? 1 : 0;
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    await import_axios.default.get(`${device.baseUrl}/ws.cgi`, {
      params,
      timeout: 5e3
    });
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
