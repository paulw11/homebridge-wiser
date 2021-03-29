'use strict';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { WiserPlatform } from './platform';
import { GroupSetEvent, WiserDevice } from './models';
import { Wiser } from './wiser';

export class WiserSwitch {

    protected wiser: Wiser;
    protected device: WiserDevice;
    protected service: Service;
    protected level = 0;
    protected previousLevel = 100;

    public readonly id: number;
    public readonly name: string;

    constructor(
        protected readonly platform: WiserPlatform,
        protected readonly accessory: PlatformAccessory,
    ) {

        this.wiser = this.accessory.context.device.wiser;
        this.device = this.accessory.context.device;
        this.id = this.accessory.context.device.id;
        this.name = this.getName();

        this.service = this.setupService();
    }

    getName(): string {
        return (typeof this.accessory.context.device.name !== 'undefined') ? this.accessory.context.device.name :
            `Switch ${this.accessory.context.device.id}`;
    }

    setupService(): Service {
        const service = this.accessory.getService(this.platform.Service.Switch) ||
            this.accessory.addService(this.platform.Service.Switch);
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Clipsal')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.accessory.context.device.id}`.padStart(4, '0'));

        service.setCharacteristic(this.platform.Characteristic.Name, this.name);

        service.getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));

        return service;
    }

    async getOn(): Promise<CharacteristicValue> {
        this.platform.log.debug(`Get on state ${this.name}(${this.id}) ${this.level > 0}`);
        return this.level > 0;
    }

    async setOn(value: CharacteristicValue) {
        const newState = `${value}` === 'true';
        const currentLevel = this.level;
        this.platform.log.debug(`${this.name} set on/off ${newState} previous level ${this.previousLevel} Current level ${currentLevel}`);
        this.level = newState ? this.previousLevel : 0;
        this.previousLevel = currentLevel;
        this.wiser.setGroupLevel(this.device.wiserProjectGroup.network, this.id, this.level);
    }

    setStatusFromEvent(groupSetEvent: GroupSetEvent) {

        this.level = Math.round(groupSetEvent.level / 255 * 100);

        this.platform.log.debug(`Update light level ${this.level}`);
        this.updateOnState();
    }

    updateOnState() {
        this.service!.updateCharacteristic(this.platform.Characteristic.On, this.level > 0);
    }


}