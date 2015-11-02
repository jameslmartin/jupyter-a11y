define(function(){
	"use strict";

	var Jupyter = require('base/js/namespace');
	var events = require('base/js/events');

	var get_mode = {
		help: 'read mode of cell',
		handler : function (env) {
			var msg = new SpeechSynthesisUtterance();
			var voices = window.speechSynthesis.getVoices();

			// Get mode from env
			var m = env.notebook.get_selected_cell().mode;

			msg.voice = voices.filter(function(voice) {return voice.name == 'Alex'; })[0];
			msg.text = String(m);
			msg.lang = 'en-US';

			speechSynthesis.speak(msg);	
		}
	}

	var read = {
		help: 'read highlighted cell',
		handler : function (env) {
			var msg = new SpeechSynthesisUtterance();
			var voices = window.speechSynthesis.getVoices();

			// May be a less-hackish way to do this	through HTML
			// Will need to get the styling for better voice control

			// Get the type of the current highlighted cell
			// Can branch based on this variable later
			var type = env.notebook.get_selected_cell().cell_type;

			var code = env.notebook.get_selected_cell().code_mirror.doc.children[0].lines;
			var text = "This is a " + type + " cell. \n";

			for (var i=0; i<code.length;i++){
				text += code[i].text + "\n";	
			}
			// Need to further experiment with voices
			msg.voice = voices.filter(function(voice) {return voice.name == 'Alex'; })[0];
			msg.text = text;
			msg.lang = 'en-US';

			speechSynthesis.speak(msg);	
		}
	}

	var kill = {
		help: 'cancel reading of cell',
		handler : function (env) {
			window.speechSynthesis.cancel();
		}
	}

	var load_extension = function(){
        var _read = Jupyter.keyboard_manager.actions.register(read, 'read highlighted cell', 'accessibility')
        var _kill = Jupyter.keyboard_manager.actions.register(kill, 'cancel reading of cell', 'accessibility')
        var _mode = Jupyter.keyboard_manager.actions.register(get_mode, 'read the mode of current cell', 'accessibility')
        console.log("Reader Loaded")
        Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-R', _read)
        Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Shift-ESC', _kill)
        Jupyter.keyboard_manager.command_shortcuts.add_shortcut('CTRL-M', _mode)
    }

	return { load_ipython_extension: load_extension }
})