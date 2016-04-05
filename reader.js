/*
 *  Author: James Martin (jamesml@cs.unc.edu)
 */

define(function() {
    "use strict";

    var Jupyter = require('base/js/namespace');
    var events = require('base/js/events');

    // Metadata
    var cell_ids = [];
    var selected_cell = 0;
    var selected_cell_id = 0;
    var selected_cell_num = 0; // Number of the selected cell down the page

    var mode = "command";

    // jQuery Deferreds
    var $voices_loaded = $.Deferred();

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

    // Global speech properties
    var speech_properties;
    speech_properties = {
        lang: 'en-us',
        rate: 1
    }

    var applyProperties = function(msg, speech_properties) {
        msg.lang = speech_properties.lang;
        msg.voice = speech_properties.voice;
        msg.rate = speech_properties.rate;
    }

    /*
     * earcon_setup(): Prepares and binds functions to kernel and notebook events. Utilizes the WebAudio API to create tones
     */
    var earcon_setup = function(events) {

        var context = new AudioContext();

        /* VCO */
        var vco = context.createOscillator();
        vco.type = vco.SINE;
        vco.start(0);

        /* VCA */
        var vca = context.createGain();
        vca.gain.value = 0;

        /* Connections */
        vco.connect(vca);
        vca.connect(context.destination);

        var playHum = function() {
            vco.frequency.value = 200;
            vca.gain.value = 0.5;
        };

        var stopHum = function() {
            vca.gain.value = 0;
        };

        events.on("kernel_idle.Kernel", function() {
            stopHum();
        })

        events.on("kernel_busy.Kernel", function() {
            playHum();
        })

        events.on("edit_mode.Notebook", function() {
            var m = "Edit";
            mode = "edit"; // Set metadata
            var msg = new SpeechSynthesisUtterance(String(m));

            msg.rate = 3
            speechSynthesis.speak(msg);
        })

        events.on("command_mode.Notebook", function() {
            var m = "Command";
            mode = "command"; // Set metadata
            var msg = new SpeechSynthesisUtterance(String(m));

            msg.rate = 3
            speechSynthesis.speak(msg);
        })

        // This function provides navigational cues
        events.on("selected_cell_type_changed.Notebook", function() {
            var previous_cell_num = selected_cell_num;

            cell_ids = get_cell_ids();

            selected_cell = Jupyter.notebook.get_selected_cell();
            selected_cell_id = Jupyter.notebook.get_selected_cell().cell_id;
            selected_cell_num = cell_ids.indexOf(selected_cell_id);

            var new_cell_num = selected_cell_num;

            var m = "";

            if (previous_cell_num > new_cell_num) {
                if (new_cell_num == 0) {
                    m = "top";
                } else {
                    m = "up";
                }
            } else {
                if (new_cell_num == cell_ids.length-1) {
                    m = "bottom";
                } else {
                    m = "down";
                }
            }
            var msg = new SpeechSynthesisUtterance(String(m));
            msg.rate = 3
            speechSynthesis.speak(msg);
        })

        // jQuery delegation to bind this listener to any keypress
        $(document).on('keypress', '.code_cell.selected', function(e){
            var charCode = e.charCode;
            if (mode === 'edit' && e.ctrlKey === false){
                read_character(charCode);
            }
        })

        // jQuery delegation to bind this listener specifically to backspace
        $(document).on('keydown', '.code_cell.selected', function(e){
            // Backspace is registered on keydown rather than keypress

            // Switch statement for future expansion
            switch (e.keyCode){

                case 8:
                    vco.frequency.value = 150;
                    vca.gain.value = 0.5;

                    setTimeout(function(){vca.gain.value = 0;}, 100);

                    var msg = new SpeechSynthesisUtterance("back");
                    msg.rate = 4;
                    speechSynthesis.speak(msg);
                    break;
            }
        })

    }

    function read_character(asciiNum){
        var keystroke = String.fromCharCode(asciiNum);
        var msg;

        // Create message to be read based on the ascii code of the keypress
        switch (asciiNum){

            // Exclamation
            case 33:
                msg = new SpeechSynthesisUtterance("exclamation");
                break;

            // Colon
            case 58:
                msg = new SpeechSynthesisUtterance("colon");
                break;

            // Semicolon
            case 59:
                msg = new SpeechSynthesisUtterance("Semicolon");
                break;

            // Equals
            case 61:
                msg = new SpeechSynthesisUtterance("equals");

            // Single quote
            case 39:
                msg = new SpeechSynthesisUtterance("single quote");
                break;

            // Double quote
            case 34:
                msg = new SpeechSynthesisUtterance("double quote");
                break;

            // Left paren
            case 40:
                msg = new SpeechSynthesisUtterance("left paren");
                break;

            // Right paren
            case 41:
                msg = new SpeechSynthesisUtterance("right paren");
                break;

            // Left bracket
            case 91:
                msg = new SpeechSynthesisUtterance("left bracket");
                break;

            // Right bracket
            case 93:
                msg = new SpeechSynthesisUtterance("right bracket");
                break;

            // Period
            case 46:
                msg = new SpeechSynthesisUtterance("dot");
                break;

            // Backslash
            case 47:
                msg = new SpeechSynthesisUtterance("backslash");
                break;

            default:
                msg = new SpeechSynthesisUtterance(keystroke);
        }
        msg.rate = 4;
        speechSynthesis.speak(msg);
    }


    /*
     * prepare(): Gets each line of the selected cell through the CodeMirror API and 
     *            passes them to the global message queue to be read. Called by readLine()
     */
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

            var utterance = new SpeechSynthesisUtterance(l.text);
            applyProperties(utterance, l.speech_properties);
            // After the line is finished speaking, call readLine() recursively to continue reading
            utterance.onend = function(event) {
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

    // Possible features:
    // When in edit mode, read single line user is on when command is issued
    // Read highlighted text
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

    var read_mode = {
        help: 'read current mode (command or edit)',
        handler: function() {
            var m = "You are in " + mode + " mode";
            var msg = new SpeechSynthesisUtterance(m);
            speechSynthesis.speak(msg);
        }
    }

    function get_cell_ids() {
        // Sets global cell_ids array
        var ids = Jupyter.notebook.get_cells().map(function(cell) {
            return cell.cell_id;
        });
        return ids;
    }

    var load_extension = function() {
        $.when($voices_loaded)
            .done(function() {
                console.log("Scripts loaded.")

                // Startup
                cell_ids = get_cell_ids();

                selected_cell_id = Jupyter.notebook.get_selected_cell().cell_id;
                selected_cell_num = cell_ids.indexOf(selected_cell_id);

                // Setup earcons
                earcon_setup(events);

                // Load actions
                var _read = Jupyter.keyboard_manager.actions.register(read, 'read', 'accessibility')
                var _cancel = Jupyter.keyboard_manager.actions.register(cancel, 'cancel', 'accessibility')
                var _skip = Jupyter.keyboard_manager.actions.register(skip, 'skip', 'accessibility')
                var _pause_resume = Jupyter.keyboard_manager.actions.register(pause_resume, 'pause or resume reading', 'accessibility')
                var _speed_up = Jupyter.keyboard_manager.actions.register(speed_up, 'speed up reading', 'accessibility')
                var _slow_down = Jupyter.keyboard_manager.actions.register(slow_down, 'slow down reading', 'accessibility')
                var _read_mode = Jupyter.keyboard_manager.actions.register(read_mode, 'read current mode (command or edit)', 'accessibility')
                console.log("Reader loaded.")

                // Bind keyboard shortcuts
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-R', _read)
                Jupyter.keyboard_manager.edit_shortcuts.add_shortcut('Ctrl-Shift-R', _read)

                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-ESC', _cancel)
                Jupyter.keyboard_manager.edit_shortcuts.add_shortcut('Ctrl-Shift-ESC', _cancel)

                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-P', _pause_resume)
                Jupyter.keyboard_manager.edit_shortcuts.add_shortcut('Ctrl-Shift-P', _pause_resume)

                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-S', _skip)
                Jupyter.keyboard_manager.edit_shortcuts.add_shortcut('Ctrl-Shift-S', _skip)

                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-+', _speed_up)
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift--', _slow_down)
                Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Ctrl-Shift-M', _read_mode)
                Jupyter.keyboard_manager.edit_shortcuts.add_shortcut('Ctrl-Shift-M', _read_mode)
                console.log("Shortcuts bound.")

                var msg = new SpeechSynthesisUtterance("Jupyter Notebook reader successfully loaded!");
                speechSynthesis.speak(msg);
            });
    }

    return {
        load_ipython_extension: load_extension
    }
})
