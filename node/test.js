var fs = require('fs');
var basic = require('./basic').basic;
 
var contents = fs.readFileSync('../examples/calculation.basic', 'utf8');
basic.interpret(contents);
