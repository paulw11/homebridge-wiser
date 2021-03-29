'use strict';

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

    constructor(public name: string) {
    }

    toString() {
        return `${this.name}`;
    }
}

export class WiserProjectGroup {

    constructor(
        public name: string,
        public groupAddress: number,
        public deviceType: DeviceType,
        public fanSpeeds: number[],
        public application,
        public network,
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