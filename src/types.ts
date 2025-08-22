
export interface DeviceConfig {
    name: string;
    ip: string;
    deviceId: string;
}

export interface AirstageDevice {
    name: string;
    ip: string;
    deviceId: string;
    baseUrl: string;
}

export interface DeviceStatus {
    power: number;
    iu_set_tmp: number;
    iu_indoor_tmp: number;
    iu_op_mode: number;
    iu_fan_spd: number;
    iu_af_dir_vrt: number;
    iu_af_dir_hrz: number;
    iu_onoff: number;
    // Optional additional fields that might be present
    ou_low_noise?: number;
    ou_econ_mode?: number;
    filter_sign_reset?: number;
}

export interface AirstageApiResponse extends Array<DeviceStatus> {}

export interface CommandParams {
    cmd: string;
    dsn: string;
    [key: string]: string | number;
}

export type OperationMode = 'auto' | 'cool' | 'heat' | 'dry' | 'fan';
export type FanSpeed = 'auto' | 'quiet' | 'low' | 'medium' | 'high';

export interface AdapterConfig {
    devices: DeviceConfig[];
    pollInterval: number;
}

// State definitions for better type safety
export interface StateDefinition {
    id: string;
    name: string;
    type: 'boolean' | 'number' | 'string';
    role: string;
    unit?: string;
    min?: number;
    max?: number;
    write: boolean;
    states?: Record<string, string>;
}

// API Error types
export interface AirstageError extends Error {
    code?: string;
    response?: {
        status: number;
        statusText: string;
        data: any;
    };
}

// Constants
export const OPERATION_MODES: Record<number, OperationMode> = {
    0: 'auto',
    1: 'cool',
    2: 'dry',
    3: 'fan',
    4: 'heat'
} as const;

export const FAN_SPEEDS: Record<number, FanSpeed> = {
    0: 'auto',
    1: 'quiet',
    2: 'low',
    3: 'medium',
    4: 'high'
} as const;

export const DEFAULT_CONFIG: AdapterConfig = {
    devices: [],
    pollInterval: 30
};

// Temperature limits
export const TEMPERATURE_LIMITS = {
    MIN: 16,
    MAX: 30
} as const;