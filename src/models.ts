'use strict';

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