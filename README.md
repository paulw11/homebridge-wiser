# homebridge-wiser
homebridge-wiser is a plug-in for [Homebridge](https://github.com/nfarina/homebridge) by Nick Farina
that adds support for the original Clipsal C-Bus Wiser.

Accessories are automatically discovered from the Wiser project.  To add
additional accessories, add them to your Wiser project and restart homebridge.

Installation
------------

You can install the plug-in using `npm`:

`sudo npm install -g homebridge-wiser`

configuration
-------------

*homebridge-wiser* is added as a `platform` in your config.json:

```
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

Credits
-------
Thanks to [Michael Farrell](http://micolous.id.au) for [Documenting](https://github.com/micolous/cbus/blob/master/docs/wiser-swf-protocol.rst)
the Wiser protocol.
