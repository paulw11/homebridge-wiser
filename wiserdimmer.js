"use strict";

var Service, Characteristic,uuid;

var WiserDimmer = function (homebridge, log, wiser, wisergroup) {

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

  this._informationService = new Service.AccessoryInformation();

  this._informationService.setCharacteristic(Characteristic.Manufacturer, 'Clipsal')
                        .setCharacteristic(Characteristic.Model, 'Dimmer')
                        .setCharacteristic(Characteristic.SerialNumber, this._group.groupAddress);
  this.name = wisergroup.name;
  var id = wisergroup.name+":"+wisergroup.groupAddress;
  this.uuid_base = id;
  this._isOn = false;
  this._onChar = this._service.getCharacteristic(Characteristic.On);
  this._onChar.on('set', this._setOn.bind(this));
  this._brightChar = this._service.getCharacteristic(Characteristic.Brightness);
  this._brightChar.on('get', this.getBrightness.bind(this))
  .on('set', this.setBrightness.bind(this));

  this._group.on('levelSet', this._levelSet.bind(this));
}

WiserDimmer.prototype._levelSet = function() {
  this.log.debug("Setting group "+this._group.name+"("+this._group.groupAddress+") to "+this._group.level);
  var level = this._group.level;
  var wasOn = this._isOn;
  this._isOn = (level > 0);
  var brightLevel = (level/255) * 100;
  if (this._isOn != wasOn) {
    this._onChar.setValue((level > 0), undefined, `event`);
  }
  this._brightChar.setValue(brightLevel, undefined, `event`);
}

WiserDimmer.prototype.getServices = function() {
  return [this._service, this._informationService];
}

WiserDimmer.prototype._setOn = function(on, callback,context) {
  if (context === `event`) {
    callback()
  } else {
    var wasOn = this._group.level > 0;

    if (wasOn != on) {
      this.log.debug("Setting switch to "+on);
      var level = 0;
      if (on) {
        level = 255;
      }
      this._isOn = on;
      this._wiser.setGroupLevel(this._group,level,0);
    }

    callback();
  }
}

WiserDimmer.prototype._getOn = function(callback) {
  callback(false,this._group.level > 0);
}

WiserDimmer.prototype.setBrightness = function(newLevel, callback,context) {
  this.log.debug('New brightness = '+newLevel);
  this.brightness = newLevel;
  this._isOn = (newLevel > 0);
  if (context === `event`) {
    callback()
  } else {
    this.log.debug("Setting dimmer to "+newLevel);

    var level = 255 * newLevel/100;

    this._wiser.setGroupLevel(this._group,level,0);

    callback();
  }
}

WiserDimmer.prototype.getBrightness = function(callback) {
  var level = (this._group.level / 255) * 100;
  callback(false,level);
}

module.exports= WiserDimmer;
