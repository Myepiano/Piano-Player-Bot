const Discord = require('discord.js');
var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
var auth = require('./auth.json');
var path = require('path');
const client = new Discord.Client();
var ready = 1;

client.on('ready', () => {
    console.log('Ready!');
});

function createTemp(message, ary, connection, bpmTempo) {

    const tempo = bpmTempo;
    var check = 0;
    ary.splice(0, 1);
    var sorted = Array.from(new Set(ary));
    var incorrect = [];

    //Shorten length of files based on the tempo inputted or the default tempo 120 BPM
    for (x = 0; x < sorted.length; x++) {

        var noteLength = tempo;
        var name = sorted[x];

        sorted[x] = sorted[x].toLowerCase();
        //Different input options
        if (sorted[x].includes('.whole') || sorted[x].includes('.w') || sorted[x].includes('.wholenote')) {
            noteLength = tempo * 4;
            name = sorted[x].substr(0, sorted[x].indexOf('.'));
        }
        if (sorted[x].includes('.half') || sorted[x].includes('.h') || sorted[x].includes('.halfnote')) {
            noteLength = tempo * 2;
            name = sorted[x].substr(0, sorted[x].indexOf('.'));
        }
        if (sorted[x].includes('.dottedq') || sorted[x].includes('.dq') || sorted[x].includes('.dottedquarter') || sorted[x].includes('.dottedquarternote')) {
            noteLength = tempo * 3 / 2;
            name = sorted[x].substr(0, sorted[x].indexOf('.'));
        }
        if (sorted[x].includes('.dottede') || sorted[x].includes('.de') || sorted[x].includes('.dottedeigth') || sorted[x].includes('.dottedeigthnote')) {
            noteLength = tempo * 3 / 4;
            name = sorted[x].substr(0, sorted[x].indexOf('.'));
        }
        if (sorted[x].includes('.triplet') || sorted[x].includes('.t') || sorted[x].includes('.tripletnote')) {
            noteLength = tempo / 3;
            name = sorted[x].substr(0, sorted[x].indexOf('.'));
        }
        if (sorted[x].includes('.eigth') || sorted[x].includes('.e') || sorted[x].includes('.eigthnote')) {
            noteLength = tempo / 2;
            name = sorted[x].substr(0, sorted[x].indexOf('.'));
        }
        if (sorted[x].includes('.sixteenth') || sorted[x].includes('.s') || sorted[x].includes('.sixteenthnote')) {
            noteLength = tempo / 4;
            name = sorted[x].substr(0, sorted[x].indexOf('.'));
        }
        if (sorted[x].includes('.thirtysecond') || sorted[x].includes('.ts') || sorted[x].includes('.thirtysecondnote')) {
            noteLength = tempo / 8;
            name = sorted[x].substr(0, sorted[x].indexOf('.'));
        }

        var originFile = './audio/Piano.ff.' + name + '.aiff';

        if (fs.existsSync(originFile)) {
            ffmpeg(originFile)
                .inputOptions([
                    '-ss 0.70',
                    '-t ' + noteLength
                ])
                .audioFilters('volume=3dB') //normalize audio volume of all files
                .on('end', function() {
                    check++;
                    //log progress of temp files being created
                    console.log(check + '/' + sorted.length + ' unique temp files made');

                    //check if async functions are done, then play the combined file
                    if (check === sorted.length) {
                        if (!(incorrect.length == 0)) {
                            message.channel.send("Invalid notes: " + incorrect);
                        }
                        combineFiles(message, ary, connection);
                    }
                })
                .output('./temp/Piano.ff.changed.' + sorted[x] + '.aiff')
                .run();
        } else {

            incorrect.push(sorted[x]);

            for (j = 0; j < ary.length; j++) {
                if (ary[j] === sorted[x]) {
                    ary.splice(j, 1);
                }
            }
            check++;
            //check if async functions are done, then play the combined file
            if (check === sorted.length) {
                if (!(incorrect.length = 0)) {
                    message.channel.send("Invalid notes: " + incorrect);
                }
                combineFiles(message, ary, connection);
            }
        }
    }
}

function combineFiles(message, ary, connection) {
    var merged = ffmpeg();

    //add all files to merged
    ary.forEach(function(audioFile) {
        if (fs.existsSync('./temp/Piano.ff.changed.' + audioFile + '.aiff')) {
            merged = merged.addInput('./temp/Piano.ff.changed.' + audioFile + '.aiff');
        }
    });

    //merged all the files to a main temp file
    merged.mergeToFile('./temp/Piano.ff.changed.main.aiff', './temp/')
        .on('error', function(err) {
            console.log(err.message);
        })
        .on('end', function() {
            console.log('Finished!');
            //Play the main temp file
            playAll(message, ary, connection);
        });
}

function playAll(message, ary, connection) {
    //Play file on discord
    message.channel.send("Playing piece!");
    
    if (fs.existsSync('./temp/Piano.ff.changed.main.aiff')) {
        //message.channel.sendFile('./temp/Piano.ff.changed.main.aiff', 'music.aiff');
        var dispatcher = connection.playFile('./temp/Piano.ff.changed.main.aiff');
    } else {
        const channel = message.member.voiceChannel;
        channel.leave();
        ready = 1;
        console.log("yes");
    }

    //Leave the voice channel while deleting temp files created
    dispatcher.on('end', () => {
        console.log('Finished playing');
        dispatcher.destroy();
        setTimeout(function() {
            const channel = message.member.voiceChannel;
            channel.leave();
            ready = 1;
        }, 2000);

        fs.readdir('./temp/', (err, files) => {
            if (err) throw err;

            for (const file of files) {
                fs.unlink(path.join('./temp/', file), err => {
                    if (err) throw err;
                });
            }
        });
        return;
    });
}
//set tempo
function settings(setOptions) {
    var tempo = 0;
    var ary = setOptions.split(":");
    tempo = ary[1].replace(/\s+/, "");
    if (isNaN(tempo)) {
        tempo: 120;
    }
    return 60 / tempo;
}
client.on('message', message => {

    const channel = message.member.voiceChannel;
    if (!message.author.bot) {
        //default tempo of 120 BPM
        var tempo = 0.5;
        var fullAry = message.content.toString().split(",");
        if (typeof fullAry[1] !== 'undefined') {
            tempo = settings(fullAry[1]);
        }

        var msgAry = fullAry[0].split(/\s+/);

        if (ready === 1) {
            if (msgAry[0] === '#play') {

                if (!(channel == null)) {
                    ready = 0;
                    channel.join()
                        .then(connection => {
                            createTemp(message, msgAry, connection, tempo);
                            message.channel.send("Loading piece...");
                        })
                        .catch(console.error);
                } else {
                    message.channel.send("Please join a voice channel first");
                }
            }
        } else if (ready === 0 && msgAry[0] === '#play') {
            message.channel.send("Please wait until the current piece is done playing");
        }
        if (message.content === '#leave' && !(channel == null)) {
            const channel = message.member.voiceChannel;
            channel.leave();
            ready = 1;
        }
        if (message.content === '#help') {
            message.channel.send(
                "List of commands: " + "\n\n" + 
                "#play - Join a voice channel and use #play followed by notes." + "\n" +
                "    Format: #play <note> <note> <note> , <tempo>" + "\n" +
                "    Example: #play c4 c4 g4 g4 a4 a4 g4.half , tempo:120" + "\n" +
                "    Acceptable note length formats for whole notes include: note.whole , note.w , and note.wholenote")
        }
    }
});

client.login(auth.token);