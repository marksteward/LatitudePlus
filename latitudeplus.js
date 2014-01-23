var fs = require('fs');
var config = JSON.parse(fs.read('latitudeplus.conf'));

var casper = require("casper").create({
    waitTimeout: 10000,
    pageSettings: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:23.0) Gecko/20130404 Firefox/23.0",
        loadPlugins: false
    },
    logLevel: 'debug',
    verbose: true
});

casper.start('https://www.google.com/settings/personalinfo', function() {
    this.capture('output/1.png');

    if (this.getCurrentUrl().indexOf('https://accounts.google.com/ServiceLogin') == 0) {
        do_login.call(this);
    }

    load_user.call(this, config.ids[0]);

});

function do_login() {
    this.fill('form#gaia_loginform', {
        Email: config.email,
        Passwd: config.password
    }, true);

    // if 2-factor:
    // https://accounts.google.com/SecondFactor?checkedDomains=youtube&checkConnection=youtube%3A94%3A1&pstMsg=1
    // gaia_secondfactorform
    // smsUserPin
    // ... or use a backup code
    // then tick "remember on this computer"

    // make sure we're redirected to https://www.google.com/ ...
    // click OK for the cookies button?
    // else screenshot and quit

    casper.then(function() {
        this.capture('output/2.png');
    });
}

function load_user(id) {

    casper.options.onResourceRequested = function(casper, req, netreq) {
        if (req.url != 'https://plus.google.com/' + id + '/posts') {
            netreq.abort();
        }
    };

    casper.thenOpen('https://plus.google.com/' + id + '/posts', function() {
        this.capture('output/3.png');
        fs.write('output/' + id + '.txt', this.getHTML());

        var result = this.evaluate(function() {
            var q = AF_initDataChunkQueue;
            for(var i = 0; i < q.length; i++) {
                if (q[i].key == '123') {
                    var data = q[i].data;
                    if (typeof(data) == 'function') data = data();
                    var locs = data[1];
                    if (locs.length) {
                        var loc = locs[0];
                        return JSON.stringify(loc.slice(0, 6));
                    }
                }
            }
        });
        try {
            var loc = JSON.parse(result);
            var lat = loc[2];
            var lon = loc[3];
            var ts = loc[4];
            var acc = loc[5];
            var output = id + ',' + ts + ',' + lat + ',' + lon + ',' + acc;
            fs.write('output/location.txt', output, 'w');
            console.log('Location updated to: ' + output);
        } catch(e) {
            console.log('Error parsing result: ' + result);
        }
    });

    casper.then(function() {
        this.wait(60 * 1000);
        load_user.call(this, config.ids[0]);
    });
}

function logout() {
    casper.thenOpen('https://accounts.google.com/Logout', function() {
        this.capture('output/4.png');
    });
}

casper.run();

/*
var server = require('webserver').create();
var service = server.listen(8001, function(request, response) {
    response.statusCode = 200;
    response.write('<html><body>Hello!</body></html>');
    response.close();
});
*/
