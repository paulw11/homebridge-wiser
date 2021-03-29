'use strict';

import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { GroupSetEvent, WiserDevice, WiserProjectGroup, DeviceType, AccessoryAddress } from './models';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Wiser } from './wiser';
import { WiserAccessory } from './WiserAccessory';
import { WiserBulb } from './wiserbulb';
import { WiserFan } from './wiserfan';
import { WiserSwitch } from './wiserswitch';
import { WiserBlind } from './wiserblind';
import { ChildBridgeExternalPortService } from 'homebridge/lib/externalPortService';


export class WiserPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory[] = [];

    private wiserAddress: string;
    private wiserPort: number;
    private username: string;
    private password: string;
    private wiser: Wiser;
    private wiserGroups: Record<number, WiserAccessory> = {};
    private ignoredAddresses: AccessoryAddress[] = [];

    private initialRetryDelay = 5000;
    private retryDelay = this.initialRetryDelay;

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
        this.log.debug('Finished initializing platform:', this.config.name);

        this.wiserAddress = this.config.wiserAddress;
        this.wiserPort = this.config.wiserPort;
        this.username = this.config.wiserUsername;
        this.password = this.config.wiserPassword;

        if (undefined !== this.config.ignoredGAs) {
            for (const address of this.config.ignoredGAs) {
                const ignore = new AccessoryAddress(address.network, address.ga);
                this.log.debug(`Adding ${ignore} to ignore list`);
                this.ignoredAddresses.push(ignore);
            }
        }

        this.wiser = new Wiser(this.wiserAddress, this.wiserPort, this.username, this.password, log);

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback');
            this.wiser.start();

            this.wiser.on('retrievedProject', (projectGroups: WiserProjectGroup[]) => {
                for (const group of projectGroups) {
                    let ignored = false;
                    for (const address of this.ignoredAddresses) {
                        if (address.network == group.address.network && address.groupAddress == group.address.groupAddress) {
                            ignored = true;
                        }
                    }
                    if (ignored) {
                        this.log.info(`Ignoring ${group.name}(${group.address})`);
                    } else {
                        this.addDevice(group);
                    }
                }
            });

            this.wiser.on('groupSet', (groupSetEvent: GroupSetEvent) => {
                this.setGroup(groupSetEvent);
            });

            this.wiser.on('groupSetScan', (groupSetEvent: GroupSetEvent) => {
                this.setGroup(groupSetEvent, false);
            });
        });
    }

    setGroup(groupSetEvent: GroupSetEvent, missingGroupIsError = true) {
        const accessory = this.wiserGroups[groupSetEvent.groupAddress];
        if (undefined !== accessory) {
            this.log.debug(`Setting ${accessory.name}(${accessory.id}) to ${groupSetEvent.level}`);
            accessory.setStatusFromEvent(groupSetEvent);
        } else {
            if (missingGroupIsError) {
                this.log.warn(`Could not find accessory to handle event for ${groupSetEvent.groupAddress}`);
            }
        }
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    addDevice(group: WiserProjectGroup) {

        const device = new WiserDevice(group.name, group.name, group.address.groupAddress, group, this.wiser);

        if (undefined !== this.wiserGroups[device.id]) {
            this.log.warn(`Ignoring duplicate device for group address ${device.id}`);
            return;
        }

        this.log.debug(`Adding group ${device.id}`);

        const uuid = this.api.hap.uuid.generate(`${group.address.network}-${group.application}-${device.id}`);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        let wiserAccessory;

        if (existingAccessory) {
            // the accessory already exists
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            existingAccessory.context.device = device;
            wiserAccessory = this.createAccessory(device, existingAccessory);
        } else {
            this.log.info('Adding new accessory:', device.displayName);
            const accessory = new this.api.platformAccessory(device.displayName, uuid);
            accessory.context.device = device;
            wiserAccessory = this.createAccessory(device, accessory);
            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        this.wiserGroups[device.id] = wiserAccessory;
    }

    createAccessory(device: WiserDevice, accessory: PlatformAccessory): WiserSwitch {


        switch (device.wiserProjectGroup.deviceType) {
            case DeviceType.switch:
                return new WiserSwitch(this, accessory);
                break;
            case DeviceType.dimmer:
                return new WiserBulb(this, accessory);
                break;
            case DeviceType.fan:
                return new WiserFan(this, accessory);
                break;
            case DeviceType.blind:
                return new WiserBlind(this, accessory);
                break;
            default:
                this.log.error(`Unknown device type ${device.wiserProjectGroup.deviceType}`)
                break;
        }
        return new WiserSwitch(this, accessory);
    }
}
/*
"use strict";

const WiserGroup = require('./wisergroup.js');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

var Wiser = function (log, address, username, password, port) {
  this.log = log;
  this.address = address;
  this.username = username;
  this.password = password;
  this.port = port;
  this.request = require('request');
  this.wiserGroups = {};
  this.namedGroups = {};
  //this.socket = require('net').Socket();
  this._backoff = 1000;
  this._wiserURL = "http://" + this.username + ":" + this.password + "@" + this.address + "/";
}

util.inherits(Wiser, EventEmitter);

Wiser.prototype.start = function () {

  this.getAuthKey(function (err, authkey) {
    if ('undefined' != err) {
      this.authKey = authkey;
      this.getProject(function (err) {
        if ('undefined' == typeof err) {
          this.connectSocket();
        } else {
          this.log.error('Error retrieving project ' + err);
          this.retryConnection();
        }
      }.bind(this));
    } else {
      this.log.error('Error retrieving Authkey ' + err);
      this.retryConnection();
    }
  }.bind(this));

}

Wiser.prototype.getAuthKey = function (callback) {
  this.request(this._wiserURL + "clipsal/resources/projectorkey.xml", function (error, response, body) {
    if (error) {
      callback(error, undefined);
    } else {
      this.log.debug(`Auth response body: ${body}`)
      var authParser = require('xml2js').parseString;
      authParser(body, function (err, result) {
        if (err || !result) {
          callback(err, undefined);
        } else {
          callback(undefined, result.cbus_auth_data.$.value);
        }
      }.bind(this));
    }
  }.bind(this));
}

Wiser.prototype.getProject = function (callback) {
  this.request(this._wiserURL + "clipsal/resources/project.xml", function (error, response, body) {
    this.log.debug(`Config response body: ${body}`)
    if (error) {
      callback(error);
    } else {
      var configParser = require('xml2js').parseString;

      configParser(body, function (err, result) {
        if (err || !result) {
          callback(err);
        } else {
          var widgets = result.Project.Widgets[0]['widget'];

          for (var i = 0; i < widgets.length; i++) {
            var params = widgets[i].params;
            var app = params[0].$.app;
            var ga = params[0].$.ga;
            var name = params[0].$.label;

            if ("undefined" != typeof app &&
              "undefined" != typeof ga &&
              "undefined" != typeof name) {
              var group = new WiserGroup(app, 254, ga, name);
              group.dimmable = (widgets[i].$.type == '1');
              this.wiserGroups[ga] = group;
              this.namedGroups[group.name] = group;
            }
          }
          callback(undefined);
        }
      }.bind(this));
    }
  }.bind(this));
}

Wiser.prototype.retryConnection = function () {
  this.log.debug("Retrying after " + this._backoff / 1000 + " seconds");
  setTimeout(function () {
    this.start();
  }.bind(this), this._backoff);
  if (this._backoff < 512000) {
    this._backoff = this._backoff * 2;
  }
}

Wiser.prototype.connectSocket = function () {
  this.socket = require('net').Socket();
  this.socket.connect(this.port, this.address);
  this.socket.on('connect', this.handleWiserConnection.bind(this));
  this.socket.on('data', this.handleWiserData.bind(this));
  this.socket.on('error', this.handleSocketError.bind(this));
  this.socket.on('close', this.socketClosed.bind(this));
}

Wiser.prototype.handleWiserConnection = function () {
  this._backoff = 1000;
  this.authenticate();
  this.getLevels();
  this.log.info('discovery complete');
  this.emit(`discoveryComplete`, this);
}

Wiser.prototype.handleWiserData = function (data) {
  var resp = "<response>" + data.toString() + "</response>";
  this.log.debug(resp);
  var dataParser = require('xml2js').parseString;
  dataParser(resp, function (err, result) {
    if (err) {
      this.log.error("Error parsing response: " + err);
    } else {
      var event = result.response.cbus_event;
      var response = result.response.cbus_resp;
      if ('undefined' != typeof event) {
        for (var i = 0; i < event.length; i++) {
          var currentEvent = event[i].$;
          var eventName = currentEvent.name;

          switch (eventName) {
            case 'cbusSetLevel':
              var group = parseInt(currentEvent.group);
              var level = parseInt(currentEvent.level);
              var wiserGroup = this.wiserGroups[group];
              if ('undefined' != typeof wiserGroup) {
                wiserGroup.setLevel(level);
              } else {
                this.log.warn('Could not find group address ' + group + ' for event ' + resp);
              }
          }
        }
      }

      if ('undefined' != typeof response) {
        var command = response[0].$.command;
        switch (command) {
          case 'cbusGetLevel':

            var levels = response[0].$.level.split(',');
            for (var i = 0; i < levels.length; i++) {
              var level = parseInt(levels[i]);
              var group = this.wiserGroups[i];
              if ('undefined' != typeof group) {
                this.log.debug("Setting level " + level + " for " + group.name);
                group.setLevel(level);
              }
            }
        }
        this.log.debug(response[0]);
      }
    }
  }.bind(this));

}

Wiser.prototype.handleSocketError = function (error) {
  this.log.error('Socket error ' + error);
}

Wiser.prototype.socketClosed = function (error) {
  if (error) {
    this.log.error('Socket closed with error');
  } else {
    this.log.info('Socket closed');
  }
  this.socket.destroy();
  this.socket = undefined;
  this.retryConnection();

}

Wiser.prototype.authenticate = function () {
  if ('undefined' == typeof this.authKey) {
    this.log.error('AuthKey is not defined');
  } else {
    this.socket.write('<cbus_auth_cmd value="' + this.authKey + '" cbc_version="3.7.0" count="0" />');
  }
}

Wiser.prototype.setGroupLevel = function (wisergroup, level, ramp) {
  if ('undefined' != typeof wisergroup && 'undefined' != typeof wisergroup.network) {
    this.setLevel(wisergroup.network, wisergroup.groupAddress, level, ramp);
  }
}

Wiser.prototype.setLevel = function (network, group, level, ramp) {
  var cmd = '<cbus_cmd app="56" command="cbusSetLevel" network="' + network +
    '" numaddresses="1" addresses="' + group +
    '" levels="' + level + '" ramps="' + ramp + '"/>';
  this.log.debug(cmd);
  this.socket.write(cmd)
}

Wiser.prototype.getLevels = function () {
  if ('undefined' != typeof this.socket.remoteAddress) {
    this.socket.write('<cbus_cmd app="0x38" command="cbusGetLevel" numaddresses="256" />');
  }
}


module.exports = Wiser;
*/