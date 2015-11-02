function p(d) {
	console.log(d);
}

var express = require('express');
var app = express();

app.use(express.static(__dirname + '/'));

var server = app.listen('9999', function() {
	p('Express server listening on 9999');
})
