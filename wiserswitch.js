"use strict";

var Service, Characteristic,uuid;

var WiserSwitch = function (homebridge, log, wiser, wisergroup) {

  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  uuid = homebridge.hap.uuid;
  this.log = log;
  this._group = wisergroup;
  this._wiser = wiser;
  if (wisergroup.dimmable) {
    this._service = new Service.Lightbulb(wisergroup.name);
  } else {
    this._service = new Service.Switch(wisergroup.name);
  }
  this.name = wisergroup.name;
  var id = wisergroup.name+":"+wisergroup.groupAddress;
  this.uuid_base = id;
  this._onChar = this._service.getCharacteristic(Characteristic.On);
  this._onChar.on('set', this._setOn.bind(this));

  this._group.on('levelSet', this._levelSet.bind(this));
}

WiserSwitch.prototype._levelSet = function() {
  this._onChar.setValue((this._group.level > 0), undefined, `event`);
}

WiserSwitch.prototype.getServices = function() {
  return [this._service];
}

WiserSwitch.prototype._setOn = function(on, callback,context) {
  if (context === `event`) {
    callback()
  } else {
    this.log.debug("Setting switch to "+on);
    var level = 0;
    if (on) {
      level = 255;
    }

    this._wiser.setGroupLevel(this._group,level,0);

    callback();
  }
}

WiserSwitch.prototype._getOn = function(callback) {
  callback(false,this._group.level > 0);
}

module.exports= WiserSwitch;
