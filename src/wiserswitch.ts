'use strict';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { WiserPlatform } from './platform';
import { GroupSetEvent } from './models';
import { WiserAccessory } from './wiseraccessory';

export class WiserSwitch extends WiserAccessory {
;

    protected level = 0;
    protected previousLevel = 100;

    constructor(
        protected readonly platform: WiserPlatform,
        protected readonly accessory: PlatformAccessory,
    ) {

        super(platform, accessory);
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
            .setCharacteristic(this.platform.Characteristic.Model, 'Switch')
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
        let targetLevel
        if (!newState) {
            this.previousLevel = this.level;
            targetLevel = 0;
        } else {
            if (this.level === 0 ) {
                targetLevel = this.previousLevel !== 0 ? this.previousLevel : 100;
            } else {
                targetLevel = this.level;
            }
        }
        this.platform.log.debug(`${this.name} set on/off ${newState} target level ${targetLevel}`);
        this.level = targetLevel;
        this.wiser.setGroupLevel(this.device.wiserProjectGroup.address, this.toWiserLevel(targetLevel));
    }

    setStatusFromEvent(groupSetEvent: GroupSetEvent) {

        this.level = this.toHomeKitLevel(groupSetEvent.level);

        this.platform.log.debug(`Update light level ${this.level}`);
        this.updateOnState();
    }

    updateOnState() {
        this.service!.updateCharacteristic(this.platform.Characteristic.On, this.level > 0);
    }

}