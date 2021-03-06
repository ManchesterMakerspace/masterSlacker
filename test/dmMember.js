var slack = {
    io: require('socket.io-client'), // npm
    connected: false,
    init: function(){
        slack.io = slack.io(process.env.MASTER_SLACKER); // slack https server
        slack.io.on('connect', function authenticate(){  // once we have connected to IPN lisner
            slack.io.emit('authenticate', {
                token: process.env.CONNECT_TOKEN,
                goodBye: 'peace out, girl scout',
                slack: {
                    username: process.env.TRUSTED_NAME,
                    channel: 'test_channel',
                    iconEmoji: ':eggplant:'
                }
            }); // its important lisner know that we are for real
            slack.connected = true;
        });
        slack.io.on('disconnect', function disconnect(){
            slack.connected = false;
        });
    },
    send: function(msg){
        if(slack.connected){
            slack.io.emit('msg', msg);
        } else {
            console.log('Not Connected:'+msg);
        }
    },
    invite: function(email){
        if(slack.connected){
            slack.io.emit('invite', email);
        } else {
            console.log('didnt invite');
        }
    },
    dm: function(memberName, msg){
        if(slack.connected){
            slack.io.emit('dm', {msg: 'testing direct messages ', name: memberName});
        } else {
            console.log('did not dm');
        }
    },
    sayItSlow: function(msg){
        var wordArray = msg.split(' ');
        console.log(wordArray);
        setTimeout(function(){slack.sayIt(wordArray);}, 2000);
    },
    sayIt: function(wordArray){
        slack.send(wordArray[0]);
        wordArray.splice(0, 1); // remover first element of Array
        if(wordArray){          // are there still words in Array
            setTimeout(function(){slack.sayIt(wordArray);}, 1000);
        }
    }
};

slack.init();
setTimeout(function(){slack.dm(process.env.MEMBER_TO_DM);}, 2000);
