/*
 *  Author: James Martin (jamesml@cs.unc.edu)
 *  TODO: 
 *    - Skip line while reading
 *    - When reading, mute other earcons?
 *    - Speed up / slow down reading
 */

define(function() {
    "use strict";

    var Jupyter = require('base/js/namespace');
    var events = require('base/js/events');

    // CDNs for needed JavaScript libraries
    var howler = 'https://cdnjs.cloudflare.com/ajax/libs/howler/1.1.28/howler.min.js';

    // jQuery Deferreds
    var $voices_loaded = $.Deferred();
    var $howler = $.Deferred();

    // Use jQuery to load Howler
    $.getScript(howler)
        .done(function(script, textStatus) {
            console.log("Howler loaded");
            $howler.resolve();
        })
        .fail(function(jqxhr, settings, exception) {
            console.log("Howler failed to load");
            console.log(exception)
        });

    // Load voices before extension
    var voices;
    window.speechSynthesis.onvoiceschanged = function() {
        voices = window.speechSynthesis.getVoices();
        $voices_loaded.resolve();
    };

    // Use push() and shift() for queue functionality
    // Not super efficient for large queues (which may happen when we start adding individual messages to the queue)
    // There is an implementation of a queue in JavaScript which runs in amortized O(1) time
    var line_queue = []

    // Want this to be a global speech_properties object, then expand on it within Read
    // Edit it when someone wants to speed up / down
    var speech_properties;
    speech_properties = {
        lang: 'en-us',
        rate: 1
    }

    // JavaScript is pass by reference, so the actual utterance is updated
    var applyProperties = function(msg, speech_properties) {
        msg.lang = speech_properties.lang;
        msg.voice = speech_properties.voice;
        msg.rate = speech_properties.rate;
    }

    /*
     * earcon_setup(): loads a sound to be played while code is executing by the kernel. Provides knowledge of
     *                 kernel state.
     */
    var earcon_setup = function(events) {

        var hum = new Howl({
            urls: ['transformer-1.mp3'], // Not sure how to specify this URL, running into this scoping issue again
            loop: true
                // onend: function() {
                //     console.log('Finished!');
                // }
        })

        var success = new Howl({
            urls: ['bell-ring-01.mp3'],
            loop: false
        })

        var error = new Howl({
            urls: ['error-alert.mp3'],
            loop: false
        })

        var playHum = function() {
            hum.play();
            console.log("Play");
        };

        var stopHum = function() {
            hum.stop();
            console.log("Stop");
        };

        events.on("kernel_idle.Kernel", function() {
            hum.stop();
            success.play();
        })

        events.on("kernel_busy.Kernel", function() {
            hum.play();
        })

        events.on("edit_mode.Notebook", function() {
            var m = "Edit";
            var msg = new SpeechSynthesisUtterance(String(m));

            applyProperties(msg, speech_properties);
            speechSynthesis.speak(msg);
        })

        events.on("command_mode.Notebook", function() {
            var m = "Command";
            var msg = new SpeechSynthesisUtterance(String(m));

            applyProperties(msg, speech_properties);
            speechSynthesis.speak(msg);
        })

        // Might want to play a noise/alert the user when they have changed cells
        // Would like to indicate whether they have moved up/down
        
        // events.on("selected_cell_type_changed.Notebook", function (){
        //     var m = "Cell changed";
        //     var msg = new SpeechSynthesisUtterance(String(m));

        //     applyProperties(msg, speech_properties);
        //     speechSynthesis.speak(msg);
        // })    
    }



    function prepare(env) {
        var speech_properties = {
            lang: 'en-US',
            voice: voices.filter(function(voice) {
                return voice.name == 'Alex';
            })[0],
            rate: 1
        }

        // Grab selected cell
        var selected_cell = env.notebook.get_selected_cell();

        // Get the type of the current highlighted cell for intro line
        var cell_type = selected_cell.cell_type;

        // Grab doc of selected cell through the Code Mirror API
        var doc = selected_cell.code_mirror.doc;
        var type_msg = "" + cell_type + " cell with " + doc.size + "";
        if (doc.size == 1) {
            var type_msg = type_msg + " line.\n.";
        } else {
            var type_msg = type_msg + " lines.\n.";
        }
        var intro = new SpeechSynthesisUtterance(type_msg);
        applyProperties(intro, speech_properties);

        speechSynthesis.speak(intro);


        // Add each line of the cell to the global message queue
        doc.eachLine(function(line) {
            var l = {
                text: line.text,
                styles: line.styles,
                cell_type: cell_type,
                speech_properties: speech_properties
            }
            line_queue.push(l);
        })
    }

    /*
     * readLine() is the work horse for read.
     */
    function readLine() {
        if (line_queue.length > 0) {
            var l = line_queue.shift()
            console.log(l.styles);

            if (l.cell_type == 'markdown') {
                l.text = l.text.replace("#", "")
            }

            if (l.cell_type == 'code') {
                // Preface comments
                if ($.inArray("comment", l.styles) != -1) {
                    var comment = "Comment: ";
                    l.text = comment.concat(l.text);
                }
            }
            var utterance = new SpeechSynthesisUtterance(l.text);
            applyProperties(utterance, l.speech_properties);
            // After the line is finished speaking, call readLine() recursively to continue reading
            utterance.onend = function(event) {
                // Bad practice here? Seems like spaghetti code chaining these calls
                // Sometimes this event is not captured. Maybe when the line is too short?
                readLine()
            }

            speechSynthesis.speak(utterance);
        }
    }

    /*
     * read(): read a highlighted cell line by line. Lines of code are created as separate messages to speak and are added
     *         into the the global message queue sequentially. This allows for the entire reading to be cancelled (with kill) or a line to be
     *         skipped. prepare() adds lines to the global message queue, readLine() takes them off, parses, and adds to the speechSynthesis queue
     */
    var read = {
        help: 'read highlighted cell',
        handler: function(env) {
            prepare(env);
            readLine();
        }
    }

    // Abruptly stops reading, clears speech and line queue
    var cancel = {
        help: 'cancel reading of cell',
        handler: function() {
            window.speechSynthesis.cancel();
            line_queue = [];
        }
    }

    // Skips current line being read
    var skip = {
        help: 'skip current line being read',
        handler: function() {
            window.speechSynthesis.cancel();
        }
    }

    // Pause / resume reading
    var pause_resume = {
        help: 'pause/resume reading',
        handler: function() {
            if (window.speechSynthesis.paused == false) {
                window.speechSynthesis.pause();
            } else {
                window.speechSynthesis.resume();
            }
        }
    }

    // Speeds up speech rate for messages that are in the global message queue
    var speed_up = {
        help: 'speed up reading',
        handler: function() {
            // So it appears that each element in line_queue share the same speech_properties object
            line_queue[0].speech_properties.rate += 1
        }
    }

    // Slows down speech rate for messages that are in the global message queue
    var slow_down = {
        help: 'slow down reading',
        handler: function() {
            element = line_queue[0];
            // Can only slow down to 1
            if (element.speech_properties.rate > 2) {
                element.speech_properties.rate -= 1;
            }
        }
    }

    var load_extension = function() {
        $.when($howler, $voices_loaded)
            .done(function() {
                console.log("Scripts loaded.")
                earcon_setup(events);
                // Load actions
                var _read = Jupyter.keyboard_manager.actions.register(read, 'read', 'accessibility')
                var _cancel = Jupyter.keyboard_manager.actions.register(cancel, 'cancel', 'accessibility')
                var _skip = Jupyter.keyboard_manager.actions.register(skip, 'skip', 'accessibility')
                var _pause_resume = Jupyter.keyboard_manager.actions.register(pause_resume, 'pause or resume reading', 'accessibility')
                var _speed_up = Jupyter.keyboard_manager.actions.register(speed_up, 'speed up reading', 'accessibility')
                var _slow_down = Jupyter.keyboard_manager.actions.register(slow_down, 'slow down reading', 'accessibility')
                console.log("Reader loaded.")
                
                // Bind keyboard shortcuts
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-R', _read)
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-ESC', _cancel)
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-P', _pause_resume)
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-S', _skip)
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-+', _speed_up)
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift--', _slow_down)
                console.log("Shortcuts bound.")
            });
    }

    return {
        load_ipython_extension: load_extension
    }
})
