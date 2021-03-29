'use strict';

import { Wiser } from "./wiser";

export class GroupSetEvent {
    constructor(
        public groupAddress: number,
        public level: number,
    ) { }
}

export class WiserProjectGroup {
    constructor(
        public name: string,
        public groupAddress: number,
        public isDimmable: boolean,
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