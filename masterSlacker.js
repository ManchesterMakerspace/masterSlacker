// masterSlacker.js ~ Copyright 2016-2018 Manchester Makerspace ~ MIT License

var bot = { // logic for adding a removing bot integrations
    s: [], // array where we store properties and functions of connected sevices
    create: function(botProperties, socketId, goodBye){
        bot.s.push({
            socketId: socketId,
            username: botProperties.username,
            iconEmoji: botProperties.iconEmoji,
            disconnectMsg: goodBye
        });
    },
    disconnect: function(socketId){                                             // hold socketId information in closure
        return function socketDisconnect(){
            bot.do(socketId, function removeBot(index){
                var UTCString = new Date().toUTCString();                       // get a string of current time
                if(bot.s[index].disconnectMsg){
                    console.log(bot.s[index].disconnectMsg);      // one last thing wont happen on falling asleep
                }
                bot.s.splice(index, 1);                                         // given its there remove bot from bots array
            });
        };
    },
    do: function(socketId, foundCallback){               // executes a callback with one of our bots based on socket id
        var botNumber = bot.s.map(function(eachBot){
            return eachBot.socketId;
        }).indexOf(socketId);                            // figure index bot in our bots array
        if(botNumber > -1){                              // NOTE we remove bots keeping ids in closure would be inaccurate
            foundCallback(botNumber);                    // part where do happens
        } else {
            console.log(socketId + ':found no bot?');    // service is not there? Should never happen but w.e.
        }
    }
};

var slack = {                                                         // uses slack api for adminastrative functions (needs admin token)
    APIURL: 'https://slack.com/api/',
    token: process.env.SLACK_TOKEN,
    request: require('request'),                                           // needed to make post request to slack api
    invite: function(socketId){
        return function onInvite(email){
            bot.do(socketId, function foundbot(botNumber){
                var request = '&email=' + email;    // NOTE: has to be a valid email, no + this or that
                var inviteAPIcall = slack.APIURL + 'users.admin.invite?token=' + slack.token + request;
                slack.request.post(inviteAPIcall, function requestRes(error, response, body){
                    var msg = 'NOT MADE';                                                // default to returning a possible error message
                    if(error){msg = 'request error:' + error;}  // post request error
                    else if (response.statusCode === 200){                          // give a good status code
                        body = JSON.parse(body);
                        if(body.ok){                                               // check if reponse body ok
                            msg = 'invite pending';                                // if true, success!
                        } else {                                                   // otherwise
                            if(body.error){msg = ' response error ' + body.error;} // log body error
                        }
                    } else { msg = 'error status ' + response.statusCode; }        // log different status code maybe expecting possible 404 not found or 504 timeout
                    console.log(msg);
                });
            });
        };
    }
};

var socket = {                                                         // socket.io singleton: handles socket server logic
    io: require('socket.io'),                                          // grab socket.io library
    tokens: process.env.TOKENS ? process.env.TOKENS.split(', ') : [],  // comma deliminated string of valid tokens
    trusted_names: process.env.TRUSTED_NAMES ? process.env.TRUSTED_NAMES.split(', ') : [], // comma deliminated string of allowed names
    listen: function(server){                                          // create server and setup on connection events
        socket.io = socket.io(server);                                 // specify http server to make connections w/ to get socket.io object
        socket.io.on('connection', function(client){                   // client holds socket vars and methods for each connection event
            client.on('authenticate', socket.setup(client));            // initially clients can only ask to authenticate
        }); // basically we want to authorize our users before setting up event handlers for them or adding them to emit whitelist
    },
    setup: function(client){                                                  // hold socketObj/key in closure, return callback to authorize user
        return function(authPacket){                                          // data passed from service {token:"valid token", name:"of service"}
            if(socket.auth(authPacket)){                                      // make sure we are connected w/ trusted source and name
                bot.create(authPacket.slack, client.id, authPacket.goodBye);  // returns number in bot array
                client.on('invite', slack.invite(client.id));            // invite new members to slack
                client.on('disconnect', bot.disconnect(client.id));           // remove service from service array on disconnect
            } else {                                                          // in case token was wrong or name not provided
                client.on('disconnect', function(){});
            }
        };
    },
    auth: function(authPacket){
        for(var i = 0; i < socket.tokens.length; i++){ // parse though array of tokens, there is a name for every token
            if(authPacket.token === socket.tokens[i] && authPacket.slack.username === socket.trusted_names[i]){
                return true;                           // given credentials line up let them do what they want
            }
        }
        return false;                                  // if we don't find something this client is no
    }
};

var server = {
    init: function(){
        var app = require('express')();
        app.get('/', function(req, res){
            res.send('erm');
        });
        return require('http').Server(app);
    },
    router: function(req, res){
        res.writeHead(200, {'Content-Type': 'text/html'});
        var incomingURL = new URL(req.url, 'http://localhost:' + process.env.PORT);
        res.write('path: ' + incomingURL.pathname + ' host: ' + incomingURL.host + ' port: ' + incomingURL.port);
        // console.log(Object.getOwnPropertyNames(req));
        // res.write('fuck');
        res.end();
    }
};

var http = server.init();
socket.listen(http); // listen and handle socket connections
http.listen(process.env.PORT);
