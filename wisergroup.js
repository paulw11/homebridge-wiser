"use strict";

const EventEmitter = require('events').EventEmitter;
const util =require('util');

var WiserGroup = function(app, network, groupAddress, name) {
    this.app = app;
    this.network = network;
    this.groupAddress = groupAddress;
    this.name = name;
    this.level = 0;
    this.dimmable = false;
  }

  util.inherits(WiserGroup,EventEmitter);

  WiserGroup.prototype.setLevel = function(level) {
    this.level = level;
    this.emit(`levelSet`,this);
  }

  module.exports = WiserGroup;
