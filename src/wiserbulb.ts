'use strict';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { WiserPlatform } from './platform';
import { GroupSetEvent } from './models';
import { Wiser } from './wiser';
import { WiserSwitch } from './wiserswitch';
import { access } from 'node:fs';

export class WiserBulb extends WiserSwitch {

    protected dimmable = false;

    constructor(
        protected readonly platform: WiserPlatform,
        protected readonly accessory: PlatformAccessory,
    ) {

        super(platform, accessory);
    }

    fetName(): string {
        return (typeof this.accessory.context.device.name !== 'undefined') ? this.accessory.context.device.name :
            `Switch ${this.accessory.context.device.id}`;
    }

    setupService(): Service {
        const service = this.accessory.getService(this.platform.Service.Lightbulb) ||
            this.accessory.addService(this.platform.Service.Lightbulb);
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Clipsal')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.accessory.context.device.id}`.padStart(4, '0'));

        service.setCharacteristic(this.platform.Characteristic.Name, this.name);

        service.getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));

        if (this.accessory.context.device.isDimmable) {
            service.getCharacteristic(this.platform.Characteristic.Brightness)
                .onGet(this.getLevel.bind(this))
                .onSet(this.setLevel.bind(this));
            this.dimmable = true;
        }

        return service;
    }

    getName(): string {
        return (typeof this.accessory.context.device.name !== 'undefined') ? this.accessory.context.device.name :
            `Light ${this.accessory.context.device.id}`;
    }

    /*async getOn(): Promise<CharacteristicValue> {
         this.platform.log.debug(`Get on state ${this.name}(${this.id}) ${this.level > 0}`);
         return this.level > 0;
     }
 
     async setOn(value: CharacteristicValue) {
         const newState = `${value}` === 'true';
         const currentLevel = this.level;
         this.platform.log.debug(`${this.name} set on/off ${newState} previous level ${this.previousLevel} Current level ${currentLevel}`);
         this.level = newState ? this.previousLevel : 0;
         this.previousLevel = currentLevel;
         this.wiser.setGroupLevel(this.id, this.level);
     }*/

    async getLevel(): Promise<CharacteristicValue> {
        const percent = this.level;
        this.platform.log.debug(`Get on state ${this.name}(${this.id}) ${this.level}`);
        return percent;
    }

    async setLevel(value: CharacteristicValue) {
        // this.previousLevel = this.level;
        this.level = Math.round(255 / 100 * parseInt(`${value}`));
        this.platform.log.debug(`Homekit set ${this.name} to ${this.level}`);
        this.wiser.setGroupLevel(this.device.wiserProjectGroup.network, this.id, this.level);
    }

    setStatusFromEvent(groupSetEvent: GroupSetEvent) {

        this.level = Math.round(groupSetEvent.level / 255 * 100);

        this.platform.log.debug(`Update light level ${this.level}`);
        this.updateOnState();
    }

    updateOnState() {
        this.service!.updateCharacteristic(this.platform.Characteristic.On, this.level > 0);
        if (this.dimmable) {
            this.service!.updateCharacteristic(this.platform.Characteristic.Brightness, this.level);
        }
    }


}