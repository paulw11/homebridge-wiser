'use strict';

import { Service, PlatformAccessory } from 'homebridge';
import { WiserPlatform } from './platform';
import { WiserDevice, GroupSetEvent } from './models';
import { Wiser } from './wiser';


export class WiserAccessory {

    protected wiser: Wiser;
    protected device: WiserDevice;
    protected service: Service;

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
        throw 'getName must be overridden in subclass';
    }

    setupService(): Service {
        throw 'setupService must be overridden in subclass';
    }

    setStatusFromEvent(groupSetEvent: GroupSetEvent) {
        throw 'setStatisFromEvent must be overridden in subclass';
    }

    toWiserLevel(level: number): number {
        return Math.round(level * 255 / 100);
    }

    toHomeKitLevel(wiserLevel: number): number {
        return Math.round(wiserLevel / 255 * 100);
    }
}