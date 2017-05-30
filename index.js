"use strict";

var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {

  Accessory = homebridge.platformAccessory;
  UUIDGen = homebridge.hap.uuid;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform("homebridge-platform-wiser", "Wiser", WiserPlatform,true);
}

function WiserPlatform(log, config, api) {
  if (!config) {
    log.warn("Ignoring Wiser platform setup because it is not configured");
    this.disabled = true;
    return;
  }

  this.config = config;

  this.wiserAddress = this.config.wiserAddress;
  this.wiserUsername = this.config.wiserUsername;
  this.wiserPassword = this.config.wiserPassword;
  this.wiserPort = this.config.wiserPort;

  this.api = api;

  Wiser = require('./wiser.js');

  var wiser = new Wiser(this.wiserAddress,
     this.wiserUsername,
     this.wiserPassword,
     this.wiserPort);

  wiser.connect();


}
