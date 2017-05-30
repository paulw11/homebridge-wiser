"use strict";

var Accessory, Service, Characteristic, UUIDGen, Wiser, WiserSwitch, WiserDimmer, Homebridge;

module.exports = function(homebridge) {

  Accessory = homebridge.platformAccessory;
  UUIDGen = homebridge.hap.uuid;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Homebridge = homebridge;
  WiserSwitch = require('./wiserswitch.js');
  WiserDimmer = require('./wiserdimmer.js');
  Wiser = require('./wiser.js');

  homebridge.registerPlatform('homebridge-platform-wiser', 'Wiser', WiserPlatform);
}

function WiserPlatform(log, config, api) {
  if (!config) {
    log.warn('Ignoring Wiser platform setup because it is not configured');
    this.disabled = true;
    return;
  }

  this.config = config;

  this.wiserAddress = this.config.wiserAddress;
  this.wiserUsername = this.config.wiserUsername;
  this.wiserPassword = this.config.wiserPassword;
  this.wiserPort = this.config.wiserPort;

  this.api = api;
  this.wiserAccessories = [];
  this.log = log;

  this.wiser = new Wiser(this.log,this.wiserAddress,
    this.wiserUsername,
    this.wiserPassword,
    this.wiserPort);

    log.info('Connecting to wiser');
    this.wiser.start();

  }

  WiserPlatform.prototype.accessories = function(callback) {
    this.log.info('setting discovery callback');
    this.wiser.on(`discoveryComplete`, function(wiser) {
      for (var key in wiser.wiserGroups) {
        var wiserswitch;
        var group = wiser.wiserGroups[key];
        if (group.dimmable) {
          wiserswitch = new WiserDimmer(Homebridge,this.log, wiser, wiser.wiserGroups[key]);
        } else {
          wiserswitch = new WiserSwitch(Homebridge,this.log, wiser, wiser.wiserGroups[key]);
        }
        this.wiserAccessories.push(wiserswitch);
      }
      callback(this.wiserAccessories);
    }.bind(this));

  };
