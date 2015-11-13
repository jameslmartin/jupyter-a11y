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

    var voices = window.speechSynthesis.getVoices()

    // Scoping problems: need this object to be visible to the applyProperties function
    // Voice is not changing with this
    // Currently using this single global speech_properties object
    // Can and will be able to specify more specific properties
    var speech_properties = {
        lang: 'en-us',
        voice: voices.filter(function(voice) {
            return voice.name == 'Alex';
        })[0],
        rate: 1
    }

    // This works for objects, just want to check
    var applyProperties = function(msg, speech_properties) {
        msg.lang = speech_properties.lang;
        msg.voice = speech_properties.voice;
        msg.rate = speech_properties.rate;
        //console.log(msg)
    }

    /*
     * earcon_setup(): loads a sound to be played while code is executing by the kernel. Provides knowledge of
     *                 kernel state.
     */
    var earcon_setup = function(events) {
        var play = function() {
            console.log("Play");
        };
        var stop = function() {
            console.log("Stop");
        };

        events.on("kernel_idle.Kernel", function() {
            stop();
        })

        events.on("kernel_busy.Kernel", function() {
            play();
        })
    }

    /*
     * get_mode(): read whether we are currently in 'Command' mode. If we are not in 'Command' mode, then this does not work...
     */
    var get_mode = {
        help: 'read mode of cell',
        handler: function(env) {
            // Get mode from env
            var m = env.notebook.get_selected_cell().mode;

            var msg = new speechSynthesisUtterance(String(m))
            applyProperties(msg, speech_properties);

            speechSynthesis.speak(msg);
        }
    }

    /*
     * read(): read a highlighted cell line by line. Lines of code are created as separate messages to speak and are added
     *         into the queue sequentially. This allows for the entire reading to be cancelled (with kill) or a line to be
     *         skipped.
     */
    var read = {
        help: 'read highlighted cell',
        handler: function(env) {

            // Grab selected cell
            var selected_cell = env.notebook.get_selected_cell();

            var msg = new SpeechSynthesisUtterance();

            // Get the type of the current highlighted cell and speak intro line
            var cell_type = selected_cell.cell_type;
            var type_msg = "This is a " + cell_type + " cell. \n";
            var msg = new SpeechSynthesisUtterance(type_msg);
            applyProperties(msg, speech_properties);

            speechSynthesis.speak(msg);

            // Grab doc of selected cell through the Code Mirror API
            var doc = selected_cell.code_mirror.doc;

            // Code cell rules
            if (cell_type === 'code') {

                doc.eachLine(function(line){
                	msg = new SpeechSynthesisUtterance(line.text);
                	applyProperties(msg, speech_properties);
                	speechSynthesis.speak(msg);

                })
                // for (var i=0; i<lines.length; i++){
                // 	//console.log(lines[i])
                // 	msg = new SpeechSynthesisUtterance(lines[i]);
                // 	applyProperties(msg, speech_properties);
                // 	speechSynthesis.speak(msg);
                // }

            // Markdown rules
            }else if(cell_type === 'markdown'){


            }else{


            }
        }
    }

    // Abruptly stops reading, clears queue of any speech messages
    var cancel = {
        help: 'cancel reading of cell',
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

    // Speeds up speech rate for future messages sent to the queue
    var speed_up = {
        help: 'speed up reading',
        handler: function() {
        	speech_properties.rate += 1;
        }
    }

    var slow_down = {
    	help: 'slow down reading',
    	handler: function(){
    		speech_properties.rate -= 1;
    	}
    }

    // var skip = {
    // 	help: 'skip current line being read',
    // 	handler : function () {
    // 		window.speechSynthesis
    // 	}
    // }

    var load_extension = function() {
        earcon_setup(events);
        var _read = Jupyter.keyboard_manager.actions.register(read, 'read', 'accessibility')
        var _cancel = Jupyter.keyboard_manager.actions.register(cancel, 'cancel', 'accessibility')
        var _mode = Jupyter.keyboard_manager.actions.register(get_mode, 'read mode of current cell', 'accessibility')
        var _pause_resume = Jupyter.keyboard_manager.actions.register(pause_resume, 'pause reading', 'accessibility')
        console.log("Reader loaded.")
        Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-R', _read)
        Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-ESC', _cancel)
        Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-P', _pause_resume)
        Jupyter.keyboard_manager.command_shortcuts.add_shortcut('CTRL-M', _mode)
    }

    return {
        load_ipython_extension: load_extension
    }
})
