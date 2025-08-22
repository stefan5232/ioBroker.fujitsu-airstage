"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var types_exports = {};
__export(types_exports, {
  DEFAULT_CONFIG: () => DEFAULT_CONFIG,
  FAN_SPEEDS: () => FAN_SPEEDS,
  OPERATION_MODES: () => OPERATION_MODES,
  TEMPERATURE_LIMITS: () => TEMPERATURE_LIMITS
});
module.exports = __toCommonJS(types_exports);
const OPERATION_MODES = {
  0: "auto",
  1: "cool",
  2: "dry",
  3: "fan",
  4: "heat"
};
const FAN_SPEEDS = {
  0: "auto",
  1: "quiet",
  2: "low",
  3: "medium",
  4: "high"
};
const DEFAULT_CONFIG = {
  devices: [],
  pollInterval: 30
};
const TEMPERATURE_LIMITS = {
  MIN: 16,
  MAX: 30
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_CONFIG,
  FAN_SPEEDS,
  OPERATION_MODES,
  TEMPERATURE_LIMITS
});
//# sourceMappingURL=types.js.map
