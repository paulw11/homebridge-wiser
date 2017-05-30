"use strict";

var WiserGroup = function(app, network, groupAddress, name) {
    this.app = app;
    this.network = network;
    this.groupAddress = groupAddress;
    this.name = name;
    this.level = 0;
    this.dimmable = false;
  }

  module.exports = WiserGroup;
