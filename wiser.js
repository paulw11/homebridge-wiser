"use strict";

const WiserGroup = require('./wisergroup.js');
const EventEmitter = require('events').EventEmitter;
const util =require('util');

var Wiser = function(log, address, username, password, port) {
    this.log = log;
    this.address = address;
    this.username = username;
    this.password = password;
    this.port = port;
    this.request = require('request');
    this.wiserGroups = {};
    this.namedGroups = {};
    this.socket = require('net').Socket();
  }

  util.inherits(Wiser,EventEmitter);

  Wiser.prototype.start = function() {
    var wiserURL = "http://"+this.username+":"+this.password+"@"+this.address+"/";
    this.request(wiserURL+"clipsal/resources/projectorkey.xml", function (error, response, body) {
      var authParser = require('xml2js').parseString;

      authParser(body, function(err,result) {
        this.authKey = result.cbus_auth_data.$.value;
      }.bind(this));
    }.bind(this));

    this.request(wiserURL+"clipsal/resources/project.xml", function (error, response, body) {
      var configParser = require('xml2js').parseString;

      configParser(body, function(err, result) {
        var widgets = result.Project.Widgets[0]['widget'];

        for (var i = 0; i < widgets.length; i++ ) {
          var params = widgets[i].params;
          var app = params[0].$.app;
          var ga = params[0].$.ga;
          var name = params[0].$.label;

          if ("undefined" != typeof app &&
          "undefined" != typeof ga &&
          "undefined" != typeof name) {
            var group = new WiserGroup(app,254,ga,name);
            group.dimmable = (widgets[i].$.type == '1');
            this.wiserGroups[ga] = group;
            this.namedGroups[group.name] = group;
          }
        }
        this.socket.connect(this.port, this.address);
        this.socket.on('connect', this.handleWiserConnection.bind(this));
        this.socket.on('data', this.handleWiserData.bind(this));
        this.socket.on('close', this.socketClosed.bind(this));
      }.bind(this));
    }.bind(this));
  }

  Wiser.prototype.handleWiserConnection = function () {
    this.authenticate();
    this.getLevels();
    this.log.info('discovery complete');
      this.log.info('notifying discovery complete');
      this.emit(`discoveryComplete`,this);
  }

  Wiser.prototype.handleWiserData = function(data) {
    var resp = "<response>"+data.toString()+"</response>";
    this.log.debug(resp);
    var dataParser = require('xml2js').parseString;
    dataParser(resp, function(err, result) {
      var event = result.response.cbus_event;
      var response = result.response.cbus_resp;
      if ('undefined' != typeof event) {
        event = event[0].$;
        var eventName = event.name;

          switch (eventName) {
            case 'cbusSetLevel':
               var group = parseInt(event.group);
               var level = parseInt(event.level);
               var wiserGroup = this.wiserGroups[group];
               if ('undefined' != typeof wiserGroup) {
               wiserGroup.setLevel(level);
             } else {
               this.log.warn('Could not find group address '+group+' for event '+resp);
             }
          }

      }

      if ('undefined' != typeof response) {
        this.log.debug("Unknown response")
        var command = response[0].$.command;
        this.log.debug(response[0]);
      }
    }.bind(this));

  }

  Wiser.prototype.socketClosed = function(error) {
    if (error) {
      this.log.error('Socket closed with error')
    } else {
      this.log.error('Socket closed');
    }

  }

  Wiser.prototype.authenticate = function() {
      if ('undefined' == typeof this.authKey) {
        this.log.error('AuthKey is not defined');
      } else {
        this.socket.write('<cbus_auth_cmd value="'+this.authKey+'" cbc_version="3.7.0" count="0" />');
      }
  }

  Wiser.prototype.setGroupLevel = function(wisergroup, level, ramp) {
    if ('undefined' != typeof wisergroup && 'undefined' != typeof wisergroup.network) {
      this.setLevel(wisergroup.network, wisergroup.groupAddress, level, ramp);
    }
  }

  Wiser.prototype.setLevel = function(network, group, level, ramp) {
    var cmd  = '<cbus_cmd app="56" command="cbusSetLevel" network="'+network+
    '" numaddresses="1" addresses="'+group+
    '" levels="'+level+'" ramps="'+ramp+'"/>';
    this.log.debug(cmd);
    this.socket.write(cmd)
  }

  Wiser.prototype.getLevels = function() {
    if ('undefined' != typeof this.socket.remoteAddress) {
      this.socket.write('<cbus_cmd app="0x38" command="cbusGetLevel" numaddresses="256" />');
    }
  }


  module.exports = Wiser;
