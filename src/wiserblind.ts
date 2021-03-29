'use strict';
import { Service, PlatformAccessory, CharacteristicValue, Characteristic } from 'homebridge';
import { WiserPlatform } from './platform';
import { GroupSetEvent } from './models';
import { WiserSwitch } from './wiserswitch';

export class WiserBlind extends WiserSwitch {

    protected targetPosition = 0;
    protected currentPosition = 0;

    constructor(
        protected readonly platform: WiserPlatform,
        protected readonly accessory: PlatformAccessory,
    ) {

        super(platform, accessory);
    }

    fetName(): string {
        return (typeof this.accessory.context.device.name !== 'undefined') ? this.accessory.context.device.name :
            `Blind ${this.accessory.context.device.id}`;
    }

    setupService(): Service {
        const service = this.accessory.getService(this.platform.Service.WindowCovering) ||
            this.accessory.addService(this.platform.Service.WindowCovering);
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Clipsal')
            .setCharacteristic(this.platform.Characteristic.Model, 'Blind')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.accessory.context.device.id}`.padStart(4, '0'));

        service.setCharacteristic(this.platform.Characteristic.Name, this.name);

        service.getCharacteristic(this.platform.Characteristic.TargetPosition)
            .onGet(this.getTarget.bind(this))
            .onSet(this.setTarget.bind(this));

        service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
            .onGet(this.getCurrent.bind(this));

        service.getCharacteristic(this.platform.Characteristic.PositionState)
            .onGet(this.getPositionState.bind(this));

        return service;
    }

    getName(): string {
        return (typeof this.accessory.context.device.name !== 'undefined') ? this.accessory.context.device.name :
            `Fan ${this.accessory.context.device.id}`;
    }

    async getTarget(): Promise<CharacteristicValue> {
        const percent = this.targetPosition;
        this.platform.log.debug(`Get target ${this.name}(${this.id}) ${percent}`);
        return percent;
    }

    async setTarget(value: CharacteristicValue) {
        this.targetPosition = parseInt(`${value}`);
        this.platform.log.debug(`Homekit set ${this.name} to ${this.level} (${this.toWiserLevel(this.targetPosition)})`);
        this.wiser.setGroupLevel(this.device.wiserProjectGroup.address, this.toWiserLevel(this.targetPosition));
    }

    async getCurrent(): Promise<CharacteristicValue> {
        const percent = this.currentPosition;
        this.platform.log.debug(`Get current position ${this.name}(${this.id}) ${percent}`);
        return percent;
    }

    async getPositionState(): Promise<CharacteristicValue> {
        const positionState = this.computePositionState();
        this.platform.log.debug(`Get position state ${this.name}(${this.id}) ${positionState}`);
        return positionState;
    }

    setStatusFromEvent(groupSetEvent: GroupSetEvent) {

        this.currentPosition = this.toHomeKitLevel(groupSetEvent.level);

        this.platform.log.debug(`Update blind position ${this.currentPosition}`);
        this.updateState();
    }

    updateState() {
        this.service!.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.currentPosition);
        this.service!.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.targetPosition);
        this.service!.updateCharacteristic(this.platform.Characteristic.PositionState, this.computePositionState());
    }

    computePositionState(): CharacteristicValue {
        if (this.currentPosition < this.targetPosition) {
            return this.platform.Characteristic.PositionState.INCREASING;
        } else if (this.currentPosition > this.targetPosition) {
            return this.platform.Characteristic.PositionState.DECREASING;
        }

        return this.platform.Characteristic.PositionState.STOPPED;
    }

}