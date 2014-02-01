var fs = require('fs');
var config = JSON.parse(fs.read('latitudeplus.conf'));

function LocationFetcher() {
    var casper;
    var usernum = 0;
    var locs = [];

    casper = require("casper").create({
        waitTimeout: 10000,
        pageSettings: {
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:23.0) Gecko/20130404 Firefox/23.0",
            loadPlugins: false
        },
        logLevel: 'debug',
        verbose: true
    });

    casper.start('http://clients3.google.com/generate_204');

    this.check_login = function() {
        casper.thenOpen('https://www.google.com/settings/personalinfo', function() {
            casper.capture('output/login-1.png');

            if (casper.getCurrentUrl().indexOf('https://accounts.google.com/ServiceLogin') == 0) {
                casper.then(do_login);
            } else {
                console.log('Already logged into Google');
            }
        });
    };

    function do_login() {
        casper.fill('form#gaia_loginform', {
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
            casper.capture('output/login-2.png');
        });
    }

    this.main_loop = function() {
        casper.then(load_next_user);
    };

    function load_next_user() {

        var id = config.users[usernum];

        casper.options.onResourceRequested = function(casper, req, netreq) {
            if (req.url != 'https://plus.google.com/' + id + '/posts') {
                netreq.abort();
            }
        };

        casper.thenOpen('https://plus.google.com/' + id + '/posts', function() {
            casper.capture('output/' + id + '.png');
            fs.write('output/' + id + '.txt', casper.getHTML());

            var result = casper.evaluate(function() {
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
                locs.push(output);
                console.log('Location updated to: ' + output);
            } catch(e) {
                console.log('Error parsing result: ' + result);
            }
            // stop the JS, reset the resource handler, and navigate to about:blank
        });

        casper.then(function() {
            casper.onResourceRequested = null;
            usernum++;

            if (usernum >= config.users.length) {
                var locations = locs.join('\n');
                fs.write('output/locations.txt', locations, 'w');

                usernum = 0;
                locs = [];

                casper.wait(60 * 1000);
                casper.then(load_next_user);

                return;
            }

            casper.wait(60 * 1000 / config.users.length);
            casper.then(load_next_user);
        });
    }

    this.run = function() {
        casper.run();
    };

    this.logout = function() {
        casper.thenOpen('https://accounts.google.com/Logout', function() {
            casper.capture('output/logout.png');
        });
    };
}

f = new LocationFetcher();
f.check_login();
f.main_loop();
f.run();

