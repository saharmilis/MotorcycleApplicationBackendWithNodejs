"use strict";

require('dotenv').config();

let env = process.env.NODE_ENV = process.env.ENV;
console.log("Loaded env config:", env);

let cfg = require('../../conf/'+env+'.js');

cfg.dirRoot = ROOT_PATH;
cfg.dirWeb = cfg.dirRoot + 'public/';
cfg.dirApp = cfg.dirRoot + 'app/';

process.argv.forEach(p =>{
	switch (p) {
		case '--reset':
			cfg.db.reset = true;
			break;
	}
});

module.exports = cfg;