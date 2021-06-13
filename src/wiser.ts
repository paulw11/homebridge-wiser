'use strict';

import { EventEmitter } from 'events';
import net from 'net';
import { AccessoryAddress, DeviceType, GroupSetEvent, WiserProjectGroup } from './models';
import { Logger } from 'homebridge';
import { Socket } from 'net';

export class Wiser extends EventEmitter {

  private wiserURL: string;
  private backoff = 1000;
  private got = require('got');
  private xml2js = require('xml2js');
  private socket: Socket | null = null;
  private authKey = '';
  private initialRetryDelay = 5000;
  private retryDelay = this.initialRetryDelay;
  private Parser = require('node-xml-stream');

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

        socket.on('data', (data) => {
          this.log.debug(`Received ${data}`);
          //  this.handleWiserData(data);
        });

        socket.on('close', () => {
          this.log.warn('Wiser socket closed');
          this.socket = null;
          this.handleConnectFailure('Socket closed');
        });

        let parser = new this.Parser();
        parser.on('opentag', (name, attrs) => {
          this.handleWiserData(name, attrs);

        });
        socket.pipe(parser);
      }).then(() => {
        this.getProject().then((projectGroups) => {
          this.emit('retrievedProject', projectGroups);
        }).catch((socketError) => {
          this.log.error(`Error connecting to wiser - ${socketError} Will retry in ${this.retryDelay / 1000}s`);
          setTimeout(() => {
            this.start();
          }, this.retryDelay);
          this.retryDelay = this.retryDelay * 2;
        });
      }).catch((error) => {
        this.handleConnectFailure(error);
      });
    }).catch((error) => {
      this.handleConnectFailure(error);
    });

  }

  handleConnectFailure(error: string) {
    this.log.error(`Error connecting to wiser - ${error} Will retry in ${this.retryDelay / 1000}s`);
    setTimeout(() => {
      this.start();
    }, this.retryDelay);
    this.retryDelay = this.retryDelay * 2;
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
        this.retryDelay = this.initialRetryDelay;
        this.log.info(`Connected to wiser ${this.address}:${this.port}`);
        resolve(socket);
      });
      socket.on('error', (error) => {
        reject(error);
        this.socket = null;
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
          case '10':
            deviceType = DeviceType.blind;
            break;
          case '25':
            deviceType = DeviceType.fan;
            break;
          default:
            deviceType = DeviceType.switch;
        }

        const fanSpeeds: number[] = [];
        if (deviceType === DeviceType.fan) {
          const speeds = params[0].$.speeds.split('|');
          for (const speed of speeds) {
            if (!isNaN(speed)) {
              fanSpeeds.push(parseInt(speed));
            }
            fanSpeeds.sort();
          }
        }
        const group = new WiserProjectGroup(name, new AccessoryAddress(network, ga), deviceType, fanSpeeds, app);
        this.log.debug(`New group ${group.address.network}:${group.address.groupAddress} of type ${group.deviceType}`);
        groups.push(group);
      }
    }

    return groups;
  }

  handleWiserData(name, attrs) {
    if ('cbus_event' === name && 'cbusSetLevel' === attrs['name']) {
      let group = parseInt(attrs['group']);
      let level = parseInt(attrs['level']);
      let app = attrs['app'];
      this.log.debug(`Setting ${group} to ${level}`);
      this.emit('groupSet', new GroupSetEvent(group, level));
    } else if ('cbus_resp' === name && 'cbusGetLevel' === attrs['command']) {
      let levels = attrs['level'].split(',');
      for (let i = 0; i < levels.length - 1; i++) {
        const level = parseInt(levels[i]);
        this.log.debug(`Setting level ${level} for ${i}`);
        this.emit('groupSetScan', new GroupSetEvent(i, level));
      }
    }
  }


  setGroupLevel(address: AccessoryAddress, level: number, ramp = 0) { // eslint-disable-next-line max-len
    const cmd = `<cbus_cmd app="56" command="cbusSetLevel" network="${address.network}" numaddresses="1" addresses="${address.groupAddress}" levels="${level}" ramps="${ramp}"/>`;
    this.log.debug(cmd);
    if (null !== this.socket) {
      this.socket!.write(cmd);
    }
  }

  private getLevels() {
    this.socket!.write('<cbus_cmd app="0x38" command="cbusGetLevel" numaddresses="256" />');
  }
}
