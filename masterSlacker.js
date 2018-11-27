// masterSlacker.js ~ Copyright 2016-2018 Manchester Makerspace ~ MIT License
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var request = require('request');
var DB_NAME = process.env.DB_NAME;

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

var slack = {                                             // uses slack api for adminastrative functions (needs admin token)
    init: function(){
        var slackEvents = require('@slack/events-api').createEventAdapter(process.env.SLACK_SIGNING_SECRET);
        slackEvents.on('team_join', slack.onTeamJoin(console.log));
        slackEvents.on('error', console.log);
        return slackEvents.createServer();     // should return http server object
    },
    invite: function(socketId){
        return function onInvite(email){
            bot.do(socketId, function foundbot(botNumber){
                var emailParam = '&email=' + email;    // NOTE: has to be a valid email, no + this or that
                var inviteAPIcall = 'https://slack.com/api/users.admin.invite?token=' + process.env.SLACK_TOKEN + emailParam;
                request.post(inviteAPIcall, function requestRes(error, response, body){
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
    },
    onTeamJoin: function(log){ // pass fuction on where to log (slack, cloudwatch, console, ect)
        return function(event){
            log(JSON.stringify(event));
            var email = event.user.profile.email;
            if(email){ // this assumes the email that we intivited them to slack with is the one that gets signed in with intially, pretty sure bet
                MongoClient.connect(process.env.MONGODB_URI, {useNewUrlParser: true}, function onConnect(connectError, client){
                    if(client){
                        client.db(DB_NAME).collection('members').findOne({email: email}, function onFind(findError, memberDoc){
                            if(memberDoc){ // given we find a member with this email
                                client.db(DB_NAME).collection('slack_users').insertOne({
                                    _id: new ObjectID(),
                                    member_id: memberDoc._id,
                                    slack_email: email,
                                    slack_id: event.user.id
                                }, function onInsert(insertError){
                                    if(insertError){log('update error: ' + insertError);}
                                    client.close();
                                });
                            } else {log('error finding member ' + findError);}
                        });
                    } else {log('error connectining to database to update new member: ' + connectError);}
                });
            } else { log('missing email');}
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

slack.init().then(function(server){
    socket.listen(server); // listen and handle socket connections
    server.listen(process.env.PORT, function serverUp(){
        // something to do when server is up
    });
});
