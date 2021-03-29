'use strict';

import { Access } from "hap-nodejs";
import { Wiser } from "./wiser";

export class GroupSetEvent {
    constructor(
        public groupAddress: number,
        public level: number,
    ) { }
}

export class DeviceType {
    static switch = new DeviceType('switch');
    static dimmer = new DeviceType('dimmer');
    static fan = new DeviceType('fan');
    static blind = new DeviceType('blind');

    constructor(public name: string) {
    }

    toString() {
        return `${this.name}`;
    }
}

export class WiserProjectGroup {

    constructor(
        public name: string,
        public address: AccessoryAddress,
        public deviceType: DeviceType,
        public fanSpeeds: number[],
        public application,
    ) { }
}

export class WiserDevice {
    constructor(
        public displayName: string,
        public name: string,
        public id: number,
        public wiserProjectGroup: WiserProjectGroup,
        public wiser: Wiser,
    ) { }
}

export class AccessoryAddress {
    constructor(
        public readonly network: number,
        public readonly groupAddress: number,
    ) { }

    toString() {
        return `${this.network}:${this.groupAddress}`;
    }
}