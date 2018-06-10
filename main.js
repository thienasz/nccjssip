//JsSIP.debug.enable('JsSIP:*');
var jsSipModule = (function($){
    //id
    var chatContentId = 'chat_content';
    var chatInfoId = 'chat_info';
    var msgInput = 'msg_input';
    var sendMsgButton = 'send_msg_btn';
    var callButton = 'call_button';
    var accToSend = 'acc_active_send';
    var clearSessionBtn = 'clear_session_btn';
    var chatWrapperId;

    //template
    var chatHtml = '<div class="row">\
        <div class="col-md-12">\
        <div class="acc-to-send form-inline mt-1 mb-1">\
        <label>To: </label>\
        <input type="text" class="form-control" placeholder="Acc active" id="'+accToSend+'" value="1003">\
        </div>\
        <div id="'+chatInfoId+'"></div>\
        <div id="'+chatContentId+'" class="chat mb-2">\
        </div>\
        </div>\
        <div class="col-md-12">\
        <div class="tool-sip">\
        <div class="input-group mb-3">\
        <input type="text" class="form-control" placeholder="Message" id="'+msgInput+'" value="">\
        <div class="input-group-append">\
        <button class="btn btn-outline-secondary" id="'+sendMsgButton+'" type="button">Send</button>\
        <button class="btn btn-outline-secondary" id="'+callButton+'" type="button">Call</button>\
        </div>\
        </div>\
        </div>\
        </div>\
        </div>';

    var incomingCallAudio = new window.Audio('https://code.bandwidth.com/media/incoming_alert.mp3');
    var domain = '35.237.8.221';//'webrtc.freeswitch.org';//'35.237.8.221';
    var ua;
    var incomingSection;
    var outgoingSection;
    var activeUser;
    var incomingUser;

    function setActiveUser(name) {
        activeUser = name;

        activeUserChange(name);
    }

    function setIncomingUser(name) {
        incomingUser = name;

        incomingUserChange(name);
    }

    var activeMsgSession;

    // call back
    var activeUserChange = function (user) {
        if($('#' + chatInfoId).find('.active-user').length > 0) {
            $('#' + chatInfoId).find('.active-user').text('Active: '+user);
        };

        $('#' + chatInfoId).prepend('<span class="active-user">Active: '+user+'</span>')
    };

    var incomingUserChange = function (user) {

        setInfoChatIncoming(user);
        if(!user) {
            return false;
        }

        if($('#'+clearSessionBtn).length < 1) {
            // disable input acc send
            $('#'+accToSend).val(user);
            $('#'+accToSend).prop('disabled', true);
            // add remove session btn
            $('#' + chatInfoId).append('<button type="button" id="'+clearSessionBtn+'">Clear Session</button>');

            $('#'+clearSessionBtn).on('click', function (e) {
                setIncomingUser(null);
                $('#'+accToSend).prop('disabled', false);
                $('#'+clearSessionBtn).remove();
                $('#'+chatContentId).html('');
            });
        }
    };

    var remoteAudio = new window.Audio();
    remoteAudio.autoplay = true;

    var register = function(username, password) {
        var socket = new JsSIP.WebSocketInterface('wss://'+ domain +':7443');
        var configuration = {
            sockets  : [ socket ],
            uri      : 'sip:'+username+'@'+domain,
            password : password
        };

        ua = new JsSIP.UA(configuration);

        ua.unregister({
            all: true
        });

        addCallback(username);

        ua.start();
    };

    var addCallback = function(username) {
        ua.on('newRTCSession', function(e){
            console.log('start session', e);
            if(e.session.direction=="incoming"){
                console.log(e);
                incomingSection = e.session;
                setStatus('Incoming', 2);
                $('#call_confirm').show();

                incomingCallAudio.play();

                //incoming call
                console.log('incoming call', e);
                // setIncomingUser()

                // e.data.session.getRemoteStreams()[0].getAudioTracks().length
            }

            // e.session.onaddstream = function(e){
            //     console.log('addstream');
            //     incomingCallAudio.pause();
            //     remoteAudio.src = window.URL.createObjectURL(e.stream);
            // };

            e.session.on('peerconnection', function(data) {
                console.log(data);
                //start

                data.peerconnection.onaddstream = function(e){
                    console.log('addstream', e);
                    incomingCallAudio.pause();
                    createNewOutputForStream(e);
                };
            });

            e.session.on('ended', function(data) {
                console.log(data);
                endCall();
            });

            e.session.on('failed', function(data) {
                console.log(data);
                endCall();
            });
        });

        ua.on('connected', function(e){
            setStatus('Connected', 2);
            console.log(incomingCallAudio);
        });

        ua.on('disconnected', function(e){
            setStatus('Disconnected', 2);
        });

        ua.on('unregistered', function(e){
            setStatus('Unregistered', 1);
        });
        ua.on('registrationFailed', function(e){
            setStatus('RegistrationFailed', 1);
        });
        ua.on('registered', function(e){
            setStatus('Registered', 1);

            setActiveUser(username);
        });

        ua.on('newMessage', function(e){
            console.log('new msg:', e);
            if(e.originator == 'remote') {
                var content = e.request.body;
                var from = e.request.from.uri.user;
                setIncomingUser(from);
                appendMsg(from, content, true);
                // activeMsgSession = e.message;
                e.message.accept();
                // change tagrget
                // activeMsgSession.send('ok');

                //set from user

            }
        });
    };

    var createNewOutputForStream = function (e) {
        if(callOptions.mediaConstraints.video) {
            try {
                // var newWindow = window.open("", "_blank", "width=auto,height=auto");
                // newWindow.document.body.innerHTML = '<video id="video" autoplay></video>'
                // var video = newWindow.document.getElementById('video');
                var video = document.getElementById('video');
                // console.log(video);
                // if (video.requestFullscreen) {
                //     video.requestFullscreen();
                // } else if (video.mozRequestFullScreen) {
                //     video.mozRequestFullScreen();
                // } else if (video.webkitRequestFullscreen) {
                //     video.webkitRequestFullscreen();
                // }
                video.srcObject = e.stream;
                // video.play();
                // newWindow.onbeforeunload = function(){
                //     endCall();
                // }
            } catch (ex){
                console.log(ex);
                remoteAudio.srcObject = e.stream;
            }
        } else {
            remoteAudio.srcObject = e.stream;
        }
    };

    var appendMsg = function (user, msg, incoming) {
        var cls = incoming ? 'text-left' : 'text-right';
        var content = '<span class="msg-content"><strong>'+user+'</strong>' + ": " + msg +'</span>';
        var ctCt = $('#'+chatContentId);
        ctCt.append('<p class="msg-chat '+cls+'">'+content+'</p>');

        ctCt.scrollTop(ctCt.get(0).scrollHeight);
    };

    var setInfoChatIncoming = function (user) {
        if($('#' + chatInfoId).find('.active-incoming-user').length > 0) {
            $('#' + chatInfoId).find('.active-incoming-user').text(' Connected: '+user);

            return;
        };

        $('#' + chatInfoId).append('<span class="active-incoming-user"> Connected: '+user+'</span>');

    };

    var removeSessionChat = function () {
        $('#' + chatInfoId).find('.active-incoming-user').remove();
        $('#' + chatInfoId).find('button').remove();
    };
    var setStatus = function(status, type) {
        console.log(status);
        if(type == 1)
            $('#sip_req_status').text(status);

        if(type == 2) {
            $('#sip_call_status').text(status);
        }

    };

    var resetSection = function() {
        incomingSection = outgoingSection = null;

        $('#call_confirm').hide();
        $('#end_call').hide();
    };

    var answer = function() {
        if(!incomingSection)
            return;
        incomingSection.answer(callOptions);
        console.log(incomingSection);
        setStatus('call connected', 2);
        $('#call_confirm').hide();
        $('#end_call').show();
    };

    var reject = function() {
        if(!incomingSection)
            return;
        incomingSection.terminate({status_code: 486});
        setStatus('call ended', 2);
        resetSection();
    };

    var endCall = function() {
        if(incomingSection && incomingSection.status != incomingSection.C.STATUS_TERMINATED)
            incomingSection.terminate();
        if(outgoingSection && outgoingSection.status != outgoingSection.C.STATUS_TERMINATED)
            outgoingSection.terminate();

        setStatus('call ended', 2);
        resetSection();
    };
    // Register callbacks to desired call events
    var eventHandlers = {
        'progress': function(e) {
            setStatus('outgoing', 2);
        },
        'failed': function(e) {
            setStatus('call failed', 2);
            endCall();
        },
        'ended': function(e) {
            setStatus('call ended', 2);
            endCall();
        },
        'accepted': function(e) {

            console.log(e);

            setStatus('call connected', 2);

            $('#end_call').show();
        }
    };

    var callOptions = {
        'eventHandlers'    : eventHandlers,
        'mediaConstraints': {audio:true, video: true},
        'sessionTimersExpires': 1800
    };

    var call = function (to) {
        outgoingSection = ua.call('sip:'+to+'@'+domain, callOptions);
        outgoingSection.connection.onaddstream = function (e) {
            createNewOutputForStream(e);
        };
        console.log(outgoingSection);
    };

    var sendMsg = function (msg, to) {
        var eventHandlersChat = {
            'succeeded': function(e){
                console.log('send ok', e);
                appendMsg(activeUser, msg, false);
                $('#'+msgInput).val('');
            },
            'failed':    function(e){
                console.log('send failed');
                alert('send ailed');
            }
        };

        var options = {
            'eventHandlers': eventHandlersChat
        };

        ua.sendMessage('sip:'+to+'@' + domain, msg, options);
        console.log('sent');
    };

    var initChatHtml = function () {
        $('#'+chatWrapperId).html(chatHtml);

        $('#'+sendMsgButton).on('click', function (e) {
            sendMsgFromInput();
        });

        $('#'+callButton).on('click', function (e) {
            var to = getUserToSendOrCall();
            call(to);
        });

        $('#'+msgInput).on('keyup', function(e){
            if(e.keyCode == 13)
            {
                sendMsgFromInput();
            }
        });

        var sendMsgFromInput = function () {
            var msg = $('#'+msgInput).val();
            var to = getUserToSendOrCall();
            if(!msg) {
                return;
            }
            sendMsg(msg, to);
        }
    };

    var init = function(chatWp) {
        $('#call_confirm').hide();
        $('#end_call').hide();

        chatWrapperId = chatWp;
        initChatHtml();

        //detect camera
        navigator.getMedia = ( navigator.getUserMedia || // use the proper vendor prefix
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia);

        navigator.getMedia({video: true}, function() {
            // webcam is available
            // test
            // callOptions.mediaConstraints = {audio: true};
        }, function() {
            // webcam is not available
            alert('webcam is not available');
            callOptions.mediaConstraints = {audio: true};
        });
    };

    var getUserToSendOrCall = function () {
        return incomingUser ? incomingUser : $('#'+ accToSend).val();
    };

    return {
        register: register,
        call: call,
        endCall: endCall,
        answer: answer,
        reject: reject,
        sendMsg: sendMsg,
        init: init
    }
})(jQuery);

jsSipModule.init('chat_wrapper');

function loginAccSip() {
    console.log(123);
    jsSipModule.register($('#username').val(), $('#password').val());
}

// function callAccSip() {
//     // jsSipModule.call($('#call_adress').val());
//     jsSipModule.call($('#acc_active_send').val());
// }

// function endCall() {
//     jsSipModule.endCall();
// }

// function sendMsg() {
//     console.log('vao send');
//     var msg = $('#msg_input').val();
//     var activeAcc = $('#acc_active_send').val();
//
//     //send
//     jsSipModule.sendMsg(msg, activeAcc);
// }