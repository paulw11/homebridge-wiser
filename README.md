homebridge-wiser
================

homebridge-wiser is a plug-in for [Homebridge](https://github.com/homebridge/homebridge)
that adds support for the original Clipsal C-Bus Wiser and the Clipsal Wiser 2.

Accessories are automatically discovered from the Wiser project.  To add
additional accessories, add them to your Wiser project and restart homebridge.

Installation
------------

You can install the plug-in using `npm`:

`sudo npm install -g homebridge-wiser`

Changes in 2.0
--------------

You will need to make some changes in your config file if you are upgrading from version 1 of this plugin.
The platform name is now `homebridge-wiser`.  Note that this change means your accessories will be re-created.

Other enhancements in 2.0 include:

* Support for fan controllers as HomeKit fans.
* Support for shutter relays as HomeKit blinds.
* The ability to ignore specific Group Addresses in the Wiser project.

Configuration
-------------

*homebridge-wiser* is added as a `platform` in your config.json:

```JSON
"platforms": [
  {
  "platform": "homebridge-wiser",
  "name": "Wiser",
  "wiserAddress": "1.2.3.4",
  "wiserUsername": "admin",
  "wiserPassword": "yourpassword",
  "wiserPort": "8888",
  "ignoredGAs": [
                {
                    "network": 254,
                    "ga": 4
                },
                {
                    "network": 254,
                    "ga": 5
                }
            ],
}
]
```

The `ignoredGAs` section is optional.  If a group address is listed in this section, an accessory will not be created
even if it is found in your Wiser project.

After adding the platform, simply restart homebridge and your C-Bus groups will
be added as new accessories automatically.

**Note**: `wiserPort` is *not* the web server port on your wiser (80).  Unless you have changed your Wiser from the default settings,
`8888` is the correct value.

Credits
-------

Thanks to [Michael Farrell](http://micolous.id.au) for some useful [Documentation](https://github.com/micolous/cbus/blob/master/docs/wiser-swf-protocol.rst)
on the Wiser.
