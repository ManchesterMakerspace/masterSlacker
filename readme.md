# masterSlacker

Copyright Manchester Makerspace 2017 ~ MIT License

2018: this is being re-factored to phase out old functionality and use the server for incoming slack events like "team-join"

Handles all slack integrations for our services, mainly this gives our interface access to the invite feature

to test locally? put this in an start.sh in this repos directory and chmod +x start.sh

    #!/bin/bash
    export PORT=3000
    export AUTH_TOKEN="token-to-prove-you-are-one-of-us"
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

from there is one event that can be emitted

'invite' : takes a email string, invites to default channels
