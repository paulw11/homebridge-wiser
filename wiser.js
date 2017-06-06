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
  //this.socket = require('net').Socket();
  this._backoff = 1000;
  this._wiserURL = "http://"+this.username+":"+this.password+"@"+this.address+"/";
}

util.inherits(Wiser,EventEmitter);

Wiser.prototype.start = function() {

  this.getAuthKey( function(err,authkey) {
    if ('undefined' != err) {
      this.authKey = authkey;
      this.getProject( function(err) {
        if ('undefined' == typeof err) {
          this.connectSocket();
        } else {
          this.log.error('Error retrieving project '+err);
          this.retryConnection();
        }
      }.bind(this));
    } else {
      this.log.error('Error retrieving Authkey '+err);
      this.retryConnection();
    }
  }.bind(this));

}

Wiser.prototype.getAuthKey = function(callback) {
  this.request(this._wiserURL+"clipsal/resources/projectorkey.xml", function (error, response, body) {
    if (error) {
      callback(error, undefined);
    } else {
      var authParser = require('xml2js').parseString;
      authParser(body, function(err,result) {
        if (err || !result){
          callback(err,undefined);
        } else {
          callback(undefined,result.cbus_auth_data.$.value);
        }
      }.bind(this));
    }
  }.bind(this));
}

Wiser.prototype.getProject = function(callback) {
  this.request(this._wiserURL+"clipsal/resources/project.xml", function (error, response, body) {
    //  this.log.debug(body);
    if (error) {
      callback(error);
    } else {
      var configParser = require('xml2js').parseString;

      configParser(body, function(err, result) {
        if (err || !result) {
          callback(err);
        } else {
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
          callback(undefined);
        }
      }.bind(this));
    }
  }.bind(this));
}

Wiser.prototype.retryConnection = function() {
  this.log.debug("Retrying after "+this._backoff/1000+" seconds");
  setTimeout(function() {
    this.start();
  }.bind(this), this._backoff);
  if (this._backoff < 512000) {
    this._backoff = this._backoff * 2;
  }
}

Wiser.prototype.connectSocket = function() {
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
      for (var i=0;i < event.length; i++) {
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
            this.log.warn('Could not find group address '+group+' for event '+resp);
          }
        }
      }
    }

    if ('undefined' != typeof response) {
      var command = response[0].$.command;
      switch (command) {
        case 'cbusGetLevel':

        var levels = response[0].$.level.split(',');
        for (var i=0;i<levels.length;i++) {
          var level = parseInt(levels[i]);
          var group = this.wiserGroups[i];
          if ('undefined' != typeof group) {
            this.log.debug("Setting level "+level+" for "+group.name);
            group.setLevel(level);
          }
        }
      }
      this.log.debug(response[0]);
    }
  }.bind(this));

}

Wiser.prototype.handleSocketError = function(error) {
  this.log.error('Socket error '+error);
}

Wiser.prototype.socketClosed = function(error) {
  if (error) {
    this.log.error('Socket closed with error');
  } else {
    this.log.info('Socket closed');
  }
  this.socket.destroy();
  this.socket = undefined;
  this.retryConnection();

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
