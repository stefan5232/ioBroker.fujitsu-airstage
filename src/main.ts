import * as utils from '@iobroker/adapter-core';
import axios, { AxiosResponse } from 'axios';

interface DeviceConfig {
    name: string;
    ip: string;
    deviceId: string;
}

interface DeviceStatus {
    //iu_model?: string; # TODO: Wenn model mit abgefragt, gibt die API nur noch 5 Werte zurück, außerdem gehen in Summe nur 20 Werte
    iu_onoff?: string | number;
    iu_op_mode?: string | number;
    iu_fan_spd?: string | number;
    iu_powerful?: string | number;
    iu_economy?: string | number;
    iu_fan_ctrl?: string | number;
    iu_set_tmp?: string | number;
    iu_indoor_tmp?: string | number;
    iu_outdoor_tmp?: string | number;
    iu_pow_cons?: string | number;
    iu_af_swg_vrt?: string | number;
    iu_af_inc_vrt?: string | number;
    iu_af_dir_vrt?: string | number;
    iu_af_dir_hrz?: string | number;
    iu_af_swg_hrz?: string | number;
    iu_hmn_det?: string | number;
    iu_hmn_det_auto_save?: string | number;
    ou_low_noise?: string | number;
    iu_wifi_led?: string | number;
    iu_min_heat?: string | number;
}

interface ApiResponse {
    value: DeviceStatus;
    read_res: string;
    device_id: string;
    device_sub_id: number;
    req_id: string;
    modified_by: string;
    set_level: string;
    cause: string;
    result: string;
    error: string;
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
type VerticalDirection = 'highest' | 'high' | 'low' | 'lowest';

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

        // Info Channel und Connection State erstellen
        await this.setObjectNotExistsAsync('info', {
            type: 'channel',
            common: {
                name: 'Information'
            },
            native: {}
        });
        await this.setObjectNotExistsAsync('info.connection', {
            type: 'state',
            common: {
                name: ' Device or service connected',
                type: 'boolean',
                role: 'indicator.connected',
                read: true,
                write: false
            },
            native: {}
        });

        // Konfiguration lesen mit Getter
        const devices: DeviceConfig[] = this.typedConfig.devices || [];

        if (devices.length === 0) {
            this.log.warn('No devices configured');
            await this.setState('info.connected', false, true);
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
                id: 'outdoor_temperature',
                name: 'Outdoor Temperature',
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
                id: 'model', // wird aktuell nicht mit abgerufen
                name: 'Device Model',
                type: 'string' as const,
                role: 'info.name',
                write: false
            },
            {
                id: 'powerful',
                name: 'Powerful Mode',
                type: 'boolean' as const,
                role: 'switch',
                write: true
            },
            {
                id: 'economy',
                name: 'Economy Mode',
                type: 'boolean' as const,
                role: 'switch',
                write: true
            },
            {
                id: 'fan_ctrl',
                name: 'Energy Saving Fan',
                type: 'boolean' as const,
                role: 'switch',
                write: true
            },
            {
                id: 'power_consumption',
                name: 'Power Consumption',
                type: 'number' as const,
                role: 'value.power.consumption',
                unit: 'W',
                write: false
            },
            {
                id: 'vertical_increments',
                name: 'Vertical Air Flow Increments',
                type: 'number' as const,
                role: 'value',
                write: false
            },
            {
                id: 'vertical_direction',
                name: 'Vertical Air Flow Direction',
                type: 'string' as const,
                role: 'text',
                states: {
                    'highest': 'Highest',
                    'high': 'High',
                    'low': 'low',
                    'lowest': 'lowest'
                },
                write: false
            },
            {
                id: 'horizontal_direction',
                name: 'Horizontal Air Flow Direction',
                type: 'number' as const,
                role: 'value',
                write: false
            },
            {
                id: 'human_detection',
                name: 'Human Detection',
                type: 'boolean' as const,
                role: 'sensor',
                write: false
            },
            {
                id: 'human_detection_auto_save',
                name: 'Human Detection Auto Save',
                type: 'boolean' as const,
                role: 'switch',
                write: false
            },
            {
                id: 'outdoor_low_noise',
                name: 'Outdoor Unit Low Noise',
                type: 'boolean' as const,
                role: 'switch',
                write: true
            },
            {
                id: 'wifi_led',
                name: 'WiFi LED',
                type: 'boolean' as const,
                role: 'switch',
                write: true
            },
            {
                id: 'min_heat',
                name: 'Minimum Heat',
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
        const payload = {
            device_id: device.deviceId,
            device_sub_id: 0,
            req_id: '',
            modified_by: '',
            set_level: '03',
            list: [
                //'iu_model',
                'iu_onoff',
                'iu_op_mode',
                'iu_fan_spd',
                'iu_powerful',
                'iu_economy',
                'iu_fan_ctrl',
                'iu_set_tmp',
                'iu_indoor_tmp',
                'iu_outdoor_tmp',
                'iu_pow_cons',
                'iu_af_swg_vrt',
                'iu_af_inc_vrt',
                'iu_af_dir_vrt',
                'iu_af_dir_hrz',
                'iu_af_swg_hrz',
                'iu_hmn_det',
                'iu_hmn_det_auto_save',
                'ou_low_noise',
                'iu_wifi_led',
                'iu_min_heat'
            ]
        };

        try {

            const response: AxiosResponse<ApiResponse> = await axios.post(
                `${device.baseUrl}/GetParam`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            );

            if (response.data && response.data.result === 'OK' && response.data.value) {
                const data = response.data.value;

                // Device als online markieren
                await this.setState(`${device.deviceId}.online`, true, true);

                // States aktualisieren mit den neuen Werten
                /*if (data.iu_model !== undefined) {
                    await this.setState(`${device.deviceId}.model`, data.iu_model, true);
                }*/
                if (data.iu_onoff !== undefined) {
                    await this.setState(`${device.deviceId}.power`, parseInt(String(data.iu_onoff)) === 1, true);
                }
                if (data.iu_op_mode !== undefined) {
                    await this.setState(`${device.deviceId}.mode`, this.mapMode(parseInt(String(data.iu_op_mode))), true);
                }
                if (data.iu_fan_spd !== undefined) {
                    await this.setState(`${device.deviceId}.fan_speed`, this.mapFanSpeed(parseInt(String(data.iu_fan_spd))), true);
                }
                if (data.iu_powerful !== undefined) {
                    await this.setState(`${device.deviceId}.powerful`, parseInt(String(data.iu_powerful)) === 1, true);
                }
                if (data.iu_economy !== undefined) {
                    await this.setState(`${device.deviceId}.economy`, parseInt(String(data.iu_economy)) === 1, true);
                }
                if (data.iu_fan_ctrl !== undefined) {
                    await this.setState(`${device.deviceId}.fan_ctrl`, parseInt(String(data.iu_fan_ctrl)) === 1, true);
                }
                if (data.iu_set_tmp !== undefined) {
                    await this.setState(`${device.deviceId}.target_temperature`, parseInt(String(data.iu_set_tmp)) / 10, true);
                }
                if (data.iu_indoor_tmp !== undefined) {
                    await this.setState(`${device.deviceId}.current_temperature`, (parseInt(String(data.iu_indoor_tmp)) - 5000) / 100, true);
                }
                if (data.iu_outdoor_tmp !== undefined) {
                    await this.setState(`${device.deviceId}.outdoor_temperature`, (parseInt(String(data.iu_outdoor_tmp)) - 5000) / 100, true);
                }
                if (data.iu_pow_cons !== undefined) {
                    await this.setState(`${device.deviceId}.power_consumption`, parseFloat(String(data.iu_pow_cons)), true);
                }
                if (data.iu_af_swg_vrt !== undefined) {
                    await this.setState(`${device.deviceId}.swing_vertical`, parseInt(String(data.iu_af_swg_vrt)) === 1, true);
                }
                if (data.iu_af_inc_vrt !== undefined) {
                    await this.setState(`${device.deviceId}.vertical_increments`, parseInt(String(data.iu_af_inc_vrt)), true);
                }
                if (data.iu_af_dir_vrt !== undefined) {
                    await this.setState(`${device.deviceId}.vertical_direction`, this.mapVerticalDirection(parseInt(String(data.iu_af_dir_vrt))), true);
                }
                if (data.iu_af_dir_hrz !== undefined) {
                    await this.setState(`${device.deviceId}.horizontal_direction`, parseInt(String(data.iu_af_dir_hrz)), true);
                }
                if (data.iu_af_swg_hrz !== undefined) {
                    await this.setState(`${device.deviceId}.swing_horizontal`, parseInt(String(data.iu_af_swg_hrz)) === 1, true);
                }
                if (data.iu_hmn_det !== undefined) {
                    await this.setState(`${device.deviceId}.human_detection`, parseInt(String(data.iu_hmn_det)) === 1, true);
                }
                if (data.iu_hmn_det_auto_save !== undefined) {
                    await this.setState(`${device.deviceId}.human_detection_auto_save`, parseInt(String(data.iu_hmn_det_auto_save)) === 1, true);
                }
                if (data.ou_low_noise !== undefined) {
                    await this.setState(`${device.deviceId}.outdoor_low_noise`, parseInt(String(data.ou_low_noise)) === 1, true);
                }
                if (data.iu_wifi_led !== undefined) {
                    await this.setState(`${device.deviceId}.wifi_led`, parseInt(String(data.iu_wifi_led)) === 1, true);
                }
                if (data.iu_min_heat !== undefined) {
                    await this.setState(`${device.deviceId}.min_heat`, parseInt(String(data.iu_min_heat)) === 1, true);
                }
                //this.log.debug(`Updated data for device ${device.name}: Power=${data.iu_onoff}, Temp=${data.iu_set_tmp}°C`);
            } else {
                this.log.warn(`No data received from device ${device.name} or error code: ${response.data?.error || response.data?.result}`);
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
        let paramName: string;
        let paramValue: string | number;
        switch (command) {
            case 'power':
                paramName = 'iu_onoff';
                paramValue = value ? 1 : 0;
                break;
            case 'target_temperature':
                const temp = parseInt(String(value));
                if (temp >= 16 && temp <= 30) {
                    paramName = 'iu_set_tmp';
                    paramValue = temp * 10; // Temperature needs to be multiplied by 10 for API
                } else {
                    throw new Error(`Invalid temperature: ${temp}. Must be between 16-30°C`);
                }
                break;
            case 'mode':
                paramName = 'iu_op_mode';
                paramValue = this.mapModeReverse(String(value) as OperationMode);
                break;
            case 'fan_speed':
                paramName = 'iu_fan_spd';
                paramValue = this.mapFanSpeedReverse(String(value) as FanSpeed);
                break;
            case 'swing_vertical':
                paramName = 'iu_af_swg_vrt';
                paramValue = value ? 1 : 0;
                break;
            case 'swing_horizontal':
                paramName = 'iu_af_swg_hrz';
                paramValue = value ? 1 : 0;
                break;
            case 'powerful':
                paramName = 'iu_powerful';
                paramValue = value ? 1 : 0;
                break;
            case 'economy':
                paramName = 'iu_economy';
                paramValue = value ? 1 : 0;
                break;
            case 'fan_ctrl':
                paramName = 'iu_fan_ctrl';
                paramValue = value ? 1 : 0;
                break;
            case 'outdoor_low_noise':
                paramName = 'ou_low_noise';
                paramValue = value ? 1 : 0;
                break;
            case 'wifi_led':
                paramName = 'iu_wifi_led';
                paramValue = value ? 1 : 0;
                break;
            case 'min_heat':
                paramName = 'iu_min_heat';
                paramValue = value ? 1 : 0;
                break;
            default:
                throw new Error(`Unknown command: ${command}`);
        }

        const payload = {
            device_id: device.deviceId,
            device_sub_id: 0,
            req_id: '',
            modified_by: '',
            set_level: '02',
            value: { [paramName]: String(paramValue) }
        };

        const response = await axios.post(`${device.baseUrl}/SetParam`, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        // Prüfen ob die Antwort erfolgreich war
        if (response.data && response.data.result !== 'OK') {
            this.log.debug(`BaseUrl: ${device.baseUrl}/GetParam -- Payload: ${JSON.stringify(payload)}`);
            throw new Error(`Command failed: ${response.data.error || response.data.result}`);
        }

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

    private mapVerticalDirection(direction: number): VerticalDirection {
        const directions: Record<number, VerticalDirection> = {
            1: 'highest',
            2: 'high',
            3: 'lowest',
            4: 'low'
        };
        return directions[direction] || 'highest';
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