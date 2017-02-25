# masterSlacker

Copyright Manchester Makerspace 2017 ~ MIT License

Handles all slack integrations for our services, mainly this gives our interface access to the invite feature

to test locally? put this in an start.sh in this repos directory and chmod +x start.sh

    #!/bin/bash
    export PORT=3000
    export AUTH_TOKEN="token-to-prove-you-are-one-of-us"
    export SLACK_WEBHOOK_URL="your-webhook-url"
    # Token for administrative access in order to invite members
    export SLACK_TOKEN="your-admin-slack-token"

    node masterSlacker.js


## What masterSlacker expects

connect to his socket server via https://hopethisisnotarealservertolinkto.herokuapp.com

you will need to emit an "authenticate" event on connecting with masterSlacker in which you will pass a access token and details about your bot

The following is the object that masterSlacker will need to set up your bot

    {
        token: "you will need to get this from masterSlacker maintainer"
        goodBye: "what your service says when it disconnects"             // empty string will not send msg
        slack: {
            username: 'nameyourbot',
            channel: 'channel_to_send_to',
            iconEmoji: ':browse_slack_emoji_for_code:'
        }
    }

from there two events can be emitted

'msg' : takes a string, sends message to channel you set up on

'invite' : takes a email string, invites to default channels

'pm' : takes and object that is looking for following properties

    {
        msg: 'the message that you are looking to send',
        userhandle: 'slack_username' // @ preface is added on masterSlacker
    }
