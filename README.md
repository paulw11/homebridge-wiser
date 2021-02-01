homebridge-wiser
================

homebridge-wiser is a plug-in for [Homebridge](https://github.com/nfarina/homebridge) by Nick Farina
that adds support for the original Clipsal C-Bus Wiser and the Clipsal Wiser 2.

Accessories are automatically discovered from the Wiser project.  To add
additional accessories, add them to your Wiser project and restart homebridge.

Installation
------------

You can install the plug-in using `npm`:

`sudo npm install -g homebridge-wiser`

Configuration
-------------

*homebridge-wiser* is added as a `platform` in your config.json:

```JSON
"platforms": [
  {
  "platform": "Wiser",
  "name": "Wiser",
  "wiserAddress": "1.2.3.4",
  "wiserUsername": "admin",
  "wiserPassword": "yourpassword",
  "wiserPort": "8888"
}
]
```

After adding the platform, simply restart homebridge and your C-Bus groups will
be added as new accessories automatically.

**Note**: `wiserPort` is *not* the web server port on your wiser (80).  Unless you have changed your Wiser from the default settings,
`8888` is the correct value.

Credits
-------

Thanks to [Michael Farrell](http://micolous.id.au) for some useful [Documentation](https://github.com/micolous/cbus/blob/master/docs/wiser-swf-protocol.rst)
on the Wiser.
