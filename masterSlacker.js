// masterSlacker.js ~ Copyright 2016 Manchester Makerspace ~ MIT License
var ONESELF = 'idformasterslacker';

var bot = { // logic for adding a removing bot integrations
    s: [], // array where we store properties and functions of connected sevices
    create: function(botProperties, socketId, goodBye){
        bot.s.push({
            socketId: socketId,
            username: botProperties.username,
            iconEmoji: botProperties.iconEmoji,
            disconnectMsg: goodBye,
            webhook: new slack.webhook(process.env.SLACK_WEBHOOK_URL, botProperties)
        });
    },
    disconnect: function(socketId){                                             // hold socketId information in closure
        return function socketDisconnect(){
            bot.do(socketId, function removeBot(index){
                var UTCString = new Date().toUTCString();                       // get a string of current time
                slack.send(ONESELF)(bot.s[index].username + ' is disconnecting');
                if(bot.s[index].disconnectMsg){
                    bot.s[index].webhook.send(bot.s[index].disconnectMsg);      // one last thing wont happen on falling asleep
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
    hook: process.env.SLACK_WEBHOOK_URL,
    webhook: require('@slack/client').IncomingWebhook,   // url to slack intergration called "webhook" can post to any channel as a "bot"
    init: function(){
        bot.create({
            username: 'masterSlacker',
            channel: 'master_slacker',
            iconEmoji: ':slack:'
        }, ONESELF, 'inconcievable');
    },
    send: function(socketId){
        return function msgEvent(msg){
            bot.do(socketId, function gotBot(botNumber){
                bot.s[botNumber].webhook.send(msg);
            });
        };
    },
    pm: function(socketId){
        return function pmMember(pmPayload){
            bot.do(socketId, function myBot(botNumber){
                var tempHook = new slack.webhook(slack.hook, {
                    username: bot.s[botNumber].username,    // reuse name of bot
                    channel: '@' + pmPayload.userhandle,    // note that we dont need @ as just name is stored in our db
                    iconEmoji: bot.s[botNumber].iconEmoji,  // reuse handle
                });
                tempHook.send(pmPayload.msg); // send pm
            });
        };
    },
    channelMsg: function(socketId){
        return function pmMember(pmPayload){
            bot.do(socketId, function myBot(botNumber){
                var tempHook = new slack.webhook(slack.hook, {
                    username: bot.s[botNumber].username,    // reuse name of bot
                    channel: pmPayload.channel,             // send to a different channel
                    iconEmoji: bot.s[botNumber].iconEmoji,  // reuse handle
                });
                tempHook.send(pmPayload.msg);               // send msg
            });
        };
    },
    dm: function(socketId){
        return function(dm){ // replacement for pm / returned callback takes object with name and msg properties
            bot.do(socketId, function onThisBot(botIndex){
                slackAdmin.findHandle(dm.name, function onFind(handle){
                    var hook = new slack.webhook(slack.hook, {
                        username: bot.s[botIndex].username,
                        channel: '@' + handle,
                        iconEmoji: bot.s[botIndex].iconEmoji
                    });
                    hook.send(dm.msg);
                }, function onNoMember(error){
                    bot.s[botIndex].webhook.send('Failed to dm ' + dm.name + ': ' + error);
                });
            });
        };
    }
};

// NOTE cannels and groups are distinctely differant. Groups are private denoted in folling ids with a 'g'. Channels can be joined by any invited team member
//  groups                                              whosAtTheSpace                                                                  Ourfrontdor
var AUTO_INVITE_CHANNELS='&channels=C050A22AL,C050A22B2,G2ADCCBAP,C0GB99JUF,C29L2UMDF,C0MHNCXGV,C1M5NRPB5,C14TZJQSY,C1M6THS3E,C1QCBJ5D3,G391Q3DGX,C3QPR4ZUL,C5HCA5YLX,C6R2JBWCE,C70BEVD42';
var slackAdmin = {                                                         // uses slack api for adminastrative functions (needs admin token)
    APIURL: 'https://slack.com/api/',
    token: process.env.SLACK_TOKEN,
    request: require('request'),                                           // needed to make post request to slack api
    invite: function(socketId){
        return function onInvite(email){
            bot.do(socketId, function foundbot(botNumber){
                var request = '&email=' + email + AUTO_INVITE_CHANNELS;    // NOTE: has to be a valid email, no + this or that
                var inviteAPIcall = slackAdmin.APIURL + 'users.admin.invite?token=' + slackAdmin.token + request;
                slackAdmin.request.post(inviteAPIcall, function requestRes(error, response, body){
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
                    bot.s[botNumber].webhook.send(msg);
                });
            });
        };
    },
    findHandle: function(memberName, success, fail, cursor){                       // recursively pagenates through request untill a member is or isn't found
        if(typeof cursor === 'undefined'){cursor = 0;}                             // .. sure this in intensive, but we don't have to store anything
        var params = '&cursor=' + cursor + '&limit=20&presence=false';             // .. maybe if slack provided a lookup by fullname or email this would be less dumb
        var APIlistMembers = slackAdmin.APIURL + 'users.list?token=' + slackAdmin.token + params;
        slackAdmin.request.post(APIlistMembers, function requestResponse(error, response, body){
            if(error){ fail(error);}
            else if(response.statusCode === 200){
                body = JSON.parse(body);
                if(body.ok){
                    var seachingForMember = true;
                    for(var i = 0; i < body.members.length; i++){
                        if(typeof body.members[i].profile.real_name_normalized === 'string'){ // make sure this is a string
                            if(body.members[i].profile.real_name_normalized.toLowerCase() === memberName.toLowerCase()){
                                success(body.members[i].name); // this is the part where we get what we want, everthing else is the opposite
                                seachingForMember = false;
                                break;
                            }
                        }
                    }
                    if(seachingForMember){
                        cursor = body.response_metadata.next_cursor;
                        if(cursor){                                               // given there are more members to search
                            slackAdmin.findHandle(memberName, success, fail, cursor); // recurse over cursor
                        } else {fail('Could not find matching handle');}
                    }
                } else {fail('Not body possitive');}
            } else {fail('non 200 status:' + response.statusCode);}
        });
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
                client.on('msg', slack.send(client.id));                      // we trust these services, just relay messages to our slack channel
                client.on('invite', slackAdmin.invite(client.id));            // invite new members to slack
                client.on('pm', slack.pm(client.id));                         // personal message members
                client.on('channelMsg', slack.channelMsg(client.id));         // messages to channels outside of default one
                client.on('dm', slack.dm(client.id));                         // Direct message to members
                client.on('disconnect', bot.disconnect(client.id));           // remove service from service array on disconnect
            } else {                                                          // in case token was wrong or name not provided
                slack.send(ONESELF)('Rejected socket connection: ' + client.id);
                client.on('disconnect', function(){
                    slack.send(ONESELF)('Rejected socket disconnected: ' + client.id);
                });
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

var route = {
    santa: function(){
        return function(req, res){
            if(req.body){
                res.status(200).send('OK');res.end();             // ACK notification
                console.log(JSON.stringify(req.body, null, 4));
            }
        };
    }
};

var serve = {                                                // handles express server setup
    express: require('express'),                             // server framework library
    parse: require('body-parser'),                           // middleware to parse JSON bodies
    theSite: function(){                                     // method call to serve site
        serve.app = serve.express();                         // create famework object
        var http = require('http').Server(serve.app);        // http server for express framework
        serve.app.use(serve.parse.json());                   // support JSON bodies
        serve.app.use(serve.parse.urlencoded({extended: true})); // idk, something was broken maybe this fixed it
        serve.router = serve.express.Router();               // create express router object to add routing events to
        serve.router.post('/santa', route.santa());          // Don't ask
        serve.app.use(serve.router);                         // get express to user the routes we set
        return http;
    }
};

var http = serve.theSite();
socket.listen(http); // listen and handle socket connections
http.listen(process.env.PORT);
slack.init();
