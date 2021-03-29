'use strict';

import { EventEmitter } from 'events';
import net from 'net';
import { DeviceType, GroupSetEvent, WiserProjectGroup } from './models';
//import { got } from 'got';
import { Logger } from 'homebridge';
//import { xml2js } from 'xml2js';
import { Socket } from 'net';

export class Wiser extends EventEmitter {

    private wiserURL: string;
    private backoff = 1000;
    private got = require('got');
    private xml2js = require('xml2js');
    private socket: Socket | null = null;
    private authKey = '';

    constructor(
        public address: string,
        public port: number = 8888,
        public username: string,
        public password: string,
        public log: Logger,
    ) {
        super();

        this.wiserURL = `http://${this.username}:${this.password}@${this.address}/`;
    }


    async start() {

        this.getAuthKey().then((authKey) => {
            this.log.debug(`Retrieved authKey ${authKey}`);
            this.authKey = authKey;
            this.connectSocket().then((socket) => {
                this.socket = socket;
                this.log.debug('***Connected***');
                this.sendAuth(socket, authKey);
                this.getLevels();
                socket.on('error', (error) => {
                    this.log.error(`Socket error ${error}`);
                    this.socket = null;
                });

                socket.on('data', (data) => {
                    this.log.debug(`Received ${data}`);
                    this.handleWiserData(data);
                });

                socket.on('close', () => {
                    this.log.warn('Wiser socket closed');
                });
            });
        }).then(() => {
            this.getProject().then((projectGroups) => {
                this.emit('retrievedProject', projectGroups);
            });
        });

    }

    sendAuth(socket: Socket, authKey: string) {
        this.log.debug('Authenticating');
        socket.write(`<cbus_auth_cmd value="${authKey}" cbc_version="3.7.0" count="0"/>`);
    }

    async getAuthKey(): Promise<string> {
        const url = `${this.wiserURL}clipsal/resources/projectorkey.xml`;
        const response = await this.got(url);
        this.log.debug(`Auth response body: ${response.body}`);
        const parser = new this.xml2js.Parser();
        return parser.parseStringPromise(response.body).then((result) => {
            return result.cbus_auth_data.$.value;
        });
    }

    async connectSocket(): Promise<Socket> {
        const socket = new net.Socket();
        socket.connect(this.port, this.address);
        return new Promise((resolve, reject) => {
            socket.on('connect', () => {
                this.log.info(`Connected to wiser ${this.address}:${this.port}`);
                resolve(socket);
            });
        });
    }

    async getProject(): Promise<[WiserProjectGroup]> {
        const url = `${this.wiserURL}clipsal/resources/project.xml`;
        const response = await this.got(url);
        this.log.debug(`project response body: ${response.body}`);
        const parser = new this.xml2js.Parser();
        return parser.parseStringPromise(response.body).then((result) => {
            return this.parseProject(result.Project);
        });
    }

    private parseProject(project): WiserProjectGroup[] {
        const widgets = project.Widgets[0]['widget'];

        const groups: WiserProjectGroup[] = [];

        for (const widget of widgets) {
            const params = widget.params;
            const app = params[0].$.app;
            const ga = params[0].$.ga;
            const name = params[0].$.label;
            const network = params[0].$.network;

            if ('undefined' !== typeof app &&
                'undefined' !== typeof ga &&
                'undefined' !== typeof name &&
                'undefined' !== typeof network) {

                let deviceType: DeviceType;

                switch (widget.$.type) {
                    case '1':
                        deviceType = DeviceType.dimmer;
                        break;
                    case '25':
                        deviceType = DeviceType.fan;
                        break;
                    default:
                        deviceType = DeviceType.switch;
                }

                const fanSpeeds:number[] = [];
                if (deviceType === DeviceType.fan) {
                    const speeds = params[0].$.speeds.split('|');
                    for (const speed of speeds) {
                        if (!isNaN(speed)) {
                            fanSpeeds.push(parseInt(speed));
                        }
                        fanSpeeds.sort();
                    }
                }
                const group = new WiserProjectGroup(name, ga, deviceType, fanSpeeds, app, network);
                this.log.debug(`New group ${group.network}:${group.groupAddress} of type ${group.deviceType}`);
                groups.push(group);
            }
        }

        return groups;
    }

    handleWiserData(data) {
        const resp = `<response>${data.toString()}</response>`;
        this.log.debug(resp);
        const dataParser = new this.xml2js.Parser();
        dataParser.parseStringPromise(resp).then((result) => {
            const event = result.response.cbus_event;
            const response = result.response.cbus_resp;
            let group: number;
            let level: number;
            let levels: [string];
            if ('undefined' !== typeof event) {
                for (let i = 0; i < event.length; i++) {
                    const currentEvent = event[i].$;
                    const eventName = currentEvent.name;
                    switch (eventName) {
                        case 'cbusSetLevel':
                            group = parseInt(currentEvent.group);
                            level = parseInt(currentEvent.level);
                            this.log.debug(`Setting ${group} to ${level}`);
                            this.emit('groupSet', new GroupSetEvent(group, level));
                            break;
                    }
                }
            }

            if ('undefined' !== typeof response) {
                const command = response[0].$.command;
                switch (command) {
                    case 'cbusGetLevel':
                        levels = response[0].$.level.split(',');
                        for (let i = 0; i < levels.length-1; i++) {
                            const level = parseInt(levels[i]);
                            this.log.debug(`Setting level ${level} for ${i}`);
                            this.emit('groupSetScan', new GroupSetEvent(i, level));
                        }
                }
            }
        })
            .catch((error) => {
                this.log.error(`Error parsing response - ${error}`);
            });
    }

    setGroupLevel(network: number, groupAddress: number, level: number, ramp = 0) {
        const cmd = `<cbus_cmd app="56" command="cbusSetLevel" network="${network}" numaddresses="1" addresses="${groupAddress}" levels="${level}" ramps="${ramp}"/>`;
        this.log.debug(cmd);
        this.socket!.write(cmd);
    }

    private getLevels() {
        this.socket!.write('<cbus_cmd app="0x38" command="cbusGetLevel" numaddresses="256" />');
    }
}

/*var Wiser = function (log, address, username, password, port) {
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


module.exports = Wiser;*/
