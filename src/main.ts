import * as utils from '@iobroker/adapter-core';
import axios, { AxiosResponse } from 'axios';

interface DeviceConfig {
    name: string;
    ip: string;
    deviceId: string;
}

interface DeviceStatus {
    power: number;
    iu_set_tmp: number;
    iu_indoor_tmp: number;
    iu_op_mode: number;
    iu_fan_spd: number;
    iu_af_dir_vrt: number;
    iu_af_dir_hrz: number;
    iu_onoff: number;
}

interface AirstageDevice {
    name: string;
    ip: string;
    deviceId: string;
    baseUrl: string;
}

interface AdapterConfig extends ioBroker.AdapterConfig {
    devices: DeviceConfig[];
    pollInterval: number;
}

type OperationMode = 'auto' | 'cool' | 'heat' | 'dry' | 'fan';
type FanSpeed = 'auto' | 'quiet' | 'low' | 'medium' | 'high';

class FujitsuAirstage extends utils.Adapter {
    private devices: AirstageDevice[] = [];
    private updateInterval: NodeJS.Timeout | null = null;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'fujitsu-airstage',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    // Getter für typisierte Konfiguration
    private get typedConfig(): AdapterConfig {
        return this.config as AdapterConfig;
    }

    private async onReady(): Promise<void> {
        this.log.info('Fujitsu Airstage adapter started');

        // Konfiguration lesen mit Getter
        const devices: DeviceConfig[] = this.typedConfig.devices || [];

        if (devices.length === 0) {
            this.log.warn('No devices configured');
            return;
        }

        // Geräte initialisieren
        for (const deviceConfig of devices) {
            await this.initDevice(deviceConfig);
        }

        // Connection state setzen
        await this.setState('info.connection', true, true);

        // Periodisches Update starten
        this.startPolling();

        this.subscribeStates('*');
    }

    private async initDevice(deviceConfig: DeviceConfig): Promise<void> {
        const { name, ip, deviceId } = deviceConfig;

        if (!ip || !deviceId) {
            this.log.error(`Device ${name}: IP or Device ID missing`);
            return;
        }

        // Device ID validieren (12 hex chars)
        if (!/^[A-Fa-f0-9]{12}$/.test(deviceId)) {
            this.log.error(`Device ${name}: Invalid Device ID format. Must be 12 hex characters (MAC without colons)`);
            return;
        }

        const deviceObj: AirstageDevice = {
            name,
            ip,
            deviceId: deviceId.toUpperCase(),
            baseUrl: `http://${ip}`
        };

        this.devices.push(deviceObj);

        // Geräte-Objekte erstellen
        await this.setObjectNotExistsAsync(deviceId, {
            type: 'device',
            common: {
                name: name || `Fujitsu ${deviceId}`,
            },
            native: deviceConfig
        });

        // States erstellen
        await this.createStates(deviceId);

        // Initialer Datenabruf
        await this.updateDeviceData(deviceObj);

        this.log.info(`Device ${name} (${deviceId}) initialized`);
    }

    private async createStates(deviceId: string): Promise<void> {
        const states = [
            {
                id: 'power',
                name: 'Power On/Off',
                type: 'boolean' as const,
                role: 'switch.power',
                write: true
            },
            {
                id: 'target_temperature',
                name: 'Target Temperature',
                type: 'number' as const,
                role: 'level.temperature',
                unit: '°C',
                min: 16,
                max: 30,
                write: true
            },
            {
                id: 'current_temperature',
                name: 'Current Temperature',
                type: 'number' as const,
                role: 'value.temperature',
                unit: '°C',
                write: false
            },
            {
                id: 'mode',
                name: 'Operation Mode',
                type: 'string' as const,
                role: 'text',
                states: {
                    'auto': 'Auto',
                    'cool': 'Cool',
                    'heat': 'Heat',
                    'dry': 'Dry',
                    'fan': 'Fan Only'
                } as Record<string, string>,
                write: true
            },
            {
                id: 'fan_speed',
                name: 'Fan Speed',
                type: 'string' as const,
                role: 'text',
                states: {
                    'auto': 'Auto',
                    'quiet': 'Quiet',
                    'low': 'Low',
                    'medium': 'Medium',
                    'high': 'High'
                } as Record<string, string>,
                write: true
            },
            {
                id: 'swing_vertical',
                name: 'Vertical Swing',
                type: 'boolean' as const,
                role: 'switch',
                write: true
            },
            {
                id: 'swing_horizontal',
                name: 'Horizontal Swing',
                type: 'boolean' as const,
                role: 'switch',
                write: true
            },
            {
                id: 'online',
                name: 'Device Online',
                type: 'boolean' as const,
                role: 'indicator.reachable',
                write: false
            }
        ];

        for (const state of states) {
            const common: ioBroker.StateCommon = {
                name: state.name,
                type: state.type,
                role: state.role,
                read: true,
                write: state.write || false,
                ...(state.unit && { unit: state.unit }),
                ...(state.min !== undefined && { min: state.min }),
                ...(state.max !== undefined && { max: state.max }),
                ...(state.states && { states: state.states })
            };

            await this.setObjectNotExistsAsync(`${deviceId}.${state.id}`, {
                type: 'state',
                common,
                native: {}
            });
        }
    }

    private async updateDeviceData(device: AirstageDevice): Promise<void> {
        try {
            // Status von der Airstage API abrufen
            const response: AxiosResponse<DeviceStatus[]> = await axios.get(`${device.baseUrl}/ws.cgi`, {
                params: {
                    cmd: 'get_device_status',
                    dsn: device.deviceId
                },
                timeout: 5000
            });

            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                const data = response.data[0];

                // Device als online markieren
                await this.setState(`${device.deviceId}.online`, true, true);

                // States aktualisieren
                await this.setState(`${device.deviceId}.power`, data.power === 1 || data.iu_onoff === 1, true);
                await this.setState(`${device.deviceId}.target_temperature`, data.iu_set_tmp || 20, true);
                await this.setState(`${device.deviceId}.current_temperature`, data.iu_indoor_tmp || 0, true);
                await this.setState(`${device.deviceId}.mode`, this.mapMode(data.iu_op_mode), true);
                await this.setState(`${device.deviceId}.fan_speed`, this.mapFanSpeed(data.iu_fan_spd), true);
                await this.setState(`${device.deviceId}.swing_vertical`, data.iu_af_dir_vrt === 1, true);
                await this.setState(`${device.deviceId}.swing_horizontal`, data.iu_af_dir_hrz === 1, true);

                this.log.debug(`Updated data for device ${device.name}: Power=${data.power}, Temp=${data.iu_set_tmp}°C`);
            } else {
                this.log.warn(`No data received from device ${device.name}`);
                await this.setState(`${device.deviceId}.online`, false, true);
            }
        } catch (error) {
            this.log.error(`Error updating device ${device.name}: ${error instanceof Error ? error.message : String(error)}`);
            await this.setState(`${device.deviceId}.online`, false, true);
        }
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state || state.ack) return;

        const parts = id.split('.');
        if (parts.length < 4) return;

        const deviceId = parts[2];
        const stateName = parts[3];
        const device = this.devices.find(d => d.deviceId === deviceId);

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

    private async sendCommand(device: AirstageDevice, command: string, value: any): Promise<void> {
        const params: Record<string, any> = {
            cmd: 'set_device_status',
            dsn: device.deviceId
        };

        switch (command) {
            case 'power':
                params.iu_onoff = value ? 1 : 0;
                break;
            case 'target_temperature':
                const temp = parseInt(String(value));
                if (temp >= 16 && temp <= 30) {
                    params.iu_set_tmp = temp;
                } else {
                    throw new Error(`Invalid temperature: ${temp}. Must be between 16-30°C`);
                }
                break;
            case 'mode':
                params.iu_op_mode = this.mapModeReverse(String(value) as OperationMode);
                break;
            case 'fan_speed':
                params.iu_fan_spd = this.mapFanSpeedReverse(String(value) as FanSpeed);
                break;
            case 'swing_vertical':
                params.iu_af_dir_vrt = value ? 1 : 0;
                break;
            case 'swing_horizontal':
                params.iu_af_dir_hrz = value ? 1 : 0;
                break;
            default:
                throw new Error(`Unknown command: ${command}`);
        }

        await axios.get(`${device.baseUrl}/ws.cgi`, {
            params,
            timeout: 5000
        });

        // Nach Kommando kurz warten und Status aktualisieren
        setTimeout(() => this.updateDeviceData(device), 1000);
    }

    private mapMode(mode: number): OperationMode {
        const modes: Record<number, OperationMode> = {
            0: 'auto',
            1: 'cool',
            2: 'dry',
            3: 'fan',
            4: 'heat'
        };
        return modes[mode] || 'auto';
    }

    private mapModeReverse(mode: OperationMode): number {
        const modes: Record<OperationMode, number> = {
            'auto': 0,
            'cool': 1,
            'dry': 2,
            'fan': 3,
            'heat': 4
        };
        return modes[mode] || 0;
    }

    private mapFanSpeed(speed: number): FanSpeed {
        const speeds: Record<number, FanSpeed> = {
            0: 'auto',
            1: 'quiet',
            2: 'low',
            3: 'medium',
            4: 'high'
        };
        return speeds[speed] || 'auto';
    }

    private mapFanSpeedReverse(speed: FanSpeed): number {
        const speeds: Record<FanSpeed, number> = {
            'auto': 0,
            'quiet': 1,
            'low': 2,
            'medium': 3,
            'high': 4
        };
        return speeds[speed] || 0;
    }

    private startPolling(): void {
        const interval = (this.typedConfig.pollInterval || 30) * 1000;

        this.updateInterval = setInterval(async () => {
            for (const device of this.devices) {
                await this.updateDeviceData(device);
            }
        }, interval);

        this.log.info(`Started polling with ${interval/1000}s interval for ${this.devices.length} device(s)`);
    }

    private onUnload(callback: () => void): void {
        try {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            this.setState('info.connection', false, true);
            this.log.info('Fujitsu Airstage adapter stopped');
            callback();
        } catch (e) {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = (options?: Partial<utils.AdapterOptions>) => new FujitsuAirstage(options);
} else {
    (() => new FujitsuAirstage())();
}