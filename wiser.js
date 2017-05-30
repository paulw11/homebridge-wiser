"use strict";

var Wiser = function(address, username, password, port) {
    this.address = address;
    this.username = username;
    this.password = password;
    this.port = port;
    this.request = require('request');
    this.wiserGroups = {};
    thius.namedGroups = {};
    this.socket = require('net').Socket();
  }

  Wiser.prototype.start = function() {
    var wiserURL = "http://"+this.username+":"+this.password+"@"+this.address+"/"
    request(wiserURL+"clipsal/resources/projectorkey.xml", function (error, response, body) {
      var authParser = require('xml2js').parseString;
      authParser(body, function(err,result) {
        this.authKey = result.cbus_auth_data.$.value;
      });
    });

    request(wiserURL+"clipsal/resources/project.xml", function (error, response, body) {
      var configParser = require('xml2js').parseString;

      configParser(body, function(err, result) {
        var widgets = result.Project.Widgets[0]['widget'];

        for (var i = 0; i < widgets.length; i++ ) {
          //  console.log(widgets[i].$);
          var params = widgets[i].params;
          var app = params[0].$.app;
          var ga = params[0].$.ga;
          var name = params[0].$.label;

          if ("undefined" != typeof app &&
          "undefined" != typeof ga &&
          "undefined" != typeof name) {
            var group = new WiserGroup(app,254,ga,name);
            group.dimmable = (widgets[i].$.type == '1');
            wiserGroups[ga] = group;
          }
        }
        socket.connect(this.port, this.address);
        socket.on('connect', this.handleWiserConnection);
        socket.on('data', this.handleWiserData);
        socket.on('close', this.socketClosed);
      });
  }

  Wiser.prototype.handleWiserConnection = function () {
    this.authenticate();
    this.getLevels();
    var study = namedGroups['Study'];
    console.log('study is '+study);
    //setGroupLevel(namedGroups['Study'],255,0);
  }

  Wiser.prototpe.handleWiserData = function(data) {
    var resp = "<response>"+data.toString()+"</response>";
    var dataParser = require('xml2js').parseString;
    dataParser(resp, function(err, result) {
      var event = result.response.cbus_event;
      var response = result.response.cbus_resp;
      if ('undefined' != typeof event) {
        console.log('event:');
        event = event[0].$;
        var eventName = event.name;

          switch (eventName) {
            case 'cbusSetLevel':
               var group = parseInt(event.group);
               var level = parseInt(event.level);
               var wiserGroup = wiserGroups[group];
               wiserGroup.level = level;
          }

      }

      if ('undefined' != typeof response) {
        console.log('response:');
        var command = response[0].$.command;
        console.log(response[0]);
      }
    });

  }

  Wiser.protoytpe.socketClosed = function(error) {
    if (error) {
      console.log('Socket closed with error')
    } else {
      console.log('Socket closed');
    }

  }

  Wiser.prototype.authenticate = function() {
      if ('undefined' == typeof authKey) {
        console.log('AuthKey is not defined');
      } else {
        this.socket.write('<cbus_auth_cmd value="'+authKey+'" cbc_version="3.7.0" count="0" />');
      }
  }

  Wiser.prototype.setGroupLevel = function(wisergroup, level, ramp) {
    if ('undefined' != typeof wisergroup && 'undefined' != typeof wisergroup.network) {
      this.setLevel(wisergroup.network, wisergroup.groupAddress, level, ramp);
    }
  }

  Wiser.prototype.setLevel = function(network, group, level, ramp) {
    this.socket.write('<cbus_cmd app="56" command="cbusSetLevel" network="'+network+
    '" numaddresses="1" addresses="'+group+
    '" levels="'+level+'" ramps="'+ramp+'"/>');
  }

  Wiser.prototype.getLevels = function() {
    if ('undefined' != typeof socket.remoteAddress) {
      this.socket.write('<cbus_cmd app="0x38" command="cbusGetLevel" numaddresses="256" />');
    }
  }


  module.exports = Wiser;
