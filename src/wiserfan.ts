'use strict';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { WiserPlatform } from './platform';
import { GroupSetEvent } from './models';
import { WiserSwitch } from './wiserswitch';

export class WiserFan extends WiserSwitch {

    constructor(
        protected readonly platform: WiserPlatform,
        protected readonly accessory: PlatformAccessory,
    ) {

        super(platform, accessory);
    }

    fetName(): string {
        return (typeof this.accessory.context.device.name !== 'undefined') ? this.accessory.context.device.name :
            `Fan ${this.accessory.context.device.id}`;
    }

    setupService(): Service {
        const service = this.accessory.getService(this.platform.Service.Fan) ||
            this.accessory.addService(this.platform.Service.Fan);
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Clipsal')
            .setCharacteristic(this.platform.Characteristic.Model, 'Fan')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.accessory.context.device.id}`.padStart(4, '0'));

        service.setCharacteristic(this.platform.Characteristic.Name, this.name);

        service.getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));

        service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onGet(this.getLevel.bind(this))
            .onSet(this.setLevel.bind(this));

        return service;
    }

    getName(): string {
        return (typeof this.accessory.context.device.name !== 'undefined') ? this.accessory.context.device.name :
            `Fan ${this.accessory.context.device.id}`;
    }

    async getLevel(): Promise<CharacteristicValue> {
        const percent = this.level;
        this.platform.log.debug(`Get state ${this.name}(${this.id}) ${this.level}`);
        return percent;
    }

    async setLevel(value: CharacteristicValue) {
        this.previousLevel = this.level;
        this.level = parseInt(`${value}`);
        this.platform.log.debug(`Homekit set ${this.name} to ${this.level} (${this.toWiserLevel(this.level)})`);
        this.wiser.setGroupLevel(this.device.wiserProjectGroup.address, this.toWiserLevel(this.level));
    }

    setStatusFromEvent(groupSetEvent: GroupSetEvent) {

        this.level = this.toHomeKitLevel(groupSetEvent.level);

        this.platform.log.debug(`Update fan speed ${this.level}`);
        this.updateState();
    }

    updateState() {
        this.service!.updateCharacteristic(this.platform.Characteristic.On, this.level > 0);
        this.service!.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.level);
    }


}