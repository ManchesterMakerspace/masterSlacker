// masterSlacker.js ~ Copyright 2016 Manchester Makerspace ~ MIT License
var ONESELF = 'idformasterslacker';

var bot = { // logic for adding a removing bot integrations
    s: [], // array where we store properties and functions of connected sevices
    create: function(botProperties, socketId){
        bot.s.push({
            socketId: socketId,
            username: botProperties.username,
            webhook: new slack.webhook(process.env.SLACK_WEBHOOK_URL, botProperties)
        });
        slack.send(ONESELF)(botProperties.username + ' just connected');
        // console.log(bot.listEm());         // log all current bots
    },
    disconnect: function(socketId){                                             // hold socketId information in closure
        return function socketDisconnect(){
            bot.do(socketId, function removeBot(index){
                var UTCString = new Date().toUTCString();                       // get a string of current time
                console.log(bot.s[index].username+' disconnecting '+UTCString); // give a warning when a bot is disconnecting
                slack.send(ONESELF)(bot.s[index].username + ' is disconnecting');
                bot.s[index].webhook.send('Im disconnected, oh noes');          // one last thing wont happen on falling asleep
                bot.s.splice(index, 1);                                         // given its there remove bot from bots array
                // console.log(bot.listEm());                                      // log all current bots
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
    },
    listEm: function(){
        var msg = 'services connected, ';                // message to build on
        for(var i = 0; i < bot.s.length; i++){           // iterate through connected services
            msg += bot.s[i].username;                    // add services name
            if(i === (bot.s.length - 1)){msg+='.';}      // given last in array concat .
            else                        {msg+=' and ';}  // given not last in array concat and
        }
        return msg;                                      // send message so that we know whos connected
    },
};

var slack = {
    webhook: require('@slack/client').IncomingWebhook,   // url to slack intergration called "webhook" can post to any channel as a "bot"
    init: function(){
        bot.create({
            username: 'masterSlacker',
            channel: 'test_channel',
            iconEmoji: ':slack:'
        }, ONESELF);
    },
    send: function(socketId){
        return function msgEvent(msg){
            bot.do(socketId, function gotBot(botNumber){
                bot.s[botNumber].webhook.send(msg);
            });
        };
    }
};

// NOTE cannels and groups are distinctely differant. Groups are private denoted in folling ids with a 'g'. Channels can be joined by any invited team member
//  groups                                                whosAtTheSpace                                                                  Ourfrontdor
var AUTO_INVITE_CHANNELS = '&channels=C050A22AL,C050A22B2,G2ADCCBAP,C0GB99JUF,C29L2UMDF,C0MHNCXGV,C1M5NRPB5,C14TZJQSY,C1M6THS3E,C1QCBJ5D3,G391Q3DGX';
var slackAdmin = {                                                         // uses slack api for adminastrative functions (needs admin token)
    request: require('request'),                                           // needed to make post request to slack api
    invite: function(socketId){
        return function onInvite(email){
            bot.do(socketId, function foundbot(botNumber){
                var request = '&email=' + email + AUTO_INVITE_CHANNELS;    // NOTE: has to be a valid email, no + this or that
                var inviteAPIcall = 'https://slack.com/api/users.admin.invite?token=' + process.env.SLACK_TOKEN + requets;
                slackAdmin.request.post(inviteAPIcall, function requestRes(error, response, body){
                    var msg = 'NOT MADE';                                                // default to returning a possible error message
                    if(error){msg = 'request error:' + error;}  // post request error
                    else if (response.statusCode == 200){                          // give a good status code
                        body = JSON.parse(body);
                        if(body.ok){                                               // check if reponse body ok
                            msg = 'invite pending';                                // if true, success!
                        } else {                                                   // otherwise
                            if(body.error){msg = ' response error ' + body.error;} // log body error
                        }
                    } else { msg = 'error status ' + response.statusCode; }        // log different status code maybe expecting possible 404 not found or 504 timeout
                    bot.s[botNumber].webhook.send(msg);
                });
            });
        };
    }
};

var socket = {                                                         // socket.io singleton: handles socket server logic
    io: require('socket.io'),                                          // grab socket.io library
    listen: function(server){                                          // create server and setup on connection events
        socket.io = socket.io(server);                                 // specify http server to make connections w/ to get socket.io object
        socket.io.on('connection', function(client){                   // client holds socket vars and methods for each connection event
            console.log('client connected:'+ client.id);               // notify when clients get connected to be assured good connections
            client.on('authenticate', socket.auth(client));            // initially clients can only ask to authenticate
        }); // basically we want to authorize our users before setting up event handlers for them or adding them to emit whitelist
    },
    auth: function(client){                                                   // hold socketObj/key in closure, return callback to authorize user
        return function(authPacket){                                          // data passed from service {token:"valid token", name:"of service"}
            if(authPacket.token === process.env.AUTH_TOKEN && authPacket.slack.username){  // make sure we are connected w/ a trusted source with a name
                bot.create(authPacket.slack, client.id);                      // returns number in bot array
                client.on('msg', slack.send(client.id));                      // we trust these services, just relay messages to our slack channel
                client.on('invite', slackAdmin.invite(client.id));            //
                client.on('disconnect', bot.disconnect(client.id));           // remove service from service array on disconnect
            } else {                                                          // in case token was wrong or name not provided
                console.log('Rejected socket connection: ' + client.id);
                client.on('disconnect', function(){
                    console.log('Rejected socket disconnected: ' + client.id);
                });
            }
        };
    }
};

var server = require('http').createServer();
socket.listen(server); // listen and handle socket connections
server.listen(process.env.PORT);
slack.init();
