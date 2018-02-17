"use strict";

let
	serve  = require('koa-static'),
	Router = require('koa-router'),
	router = Router(),
	koa    = module.exports = require('koa'),
	session    = require('koa-session'),
	bodyParser = require('koa-bodyparser'),
	winston    = require('winston'),
	Pug        = require('koa-pug')
;


global.cfg = require('./config/config.js');

// setup logger
global.$logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({level: cfg.log_level})
	]
});

let app = new koa();

app.name = "wr-fleet";
app.env  = process.env.NODE_ENV || 'development';


global.lib            = {};
global.service        = {};
lib.common            = require('./lib/common.js');
lib.email             = require('./lib/email.js')(cfg);
lib.push_notification = require('./lib/push-notifications.js');


function _jsonResponse(ctx, data) {
	ctx.response.set('Content-Type', 'application/json');
	// if (!data) data = {};
	let resp = {
		data: data
	};
	resp.err = 0;
	ctx.body = resp;
}

function _jsonError(ctx, errdesc, code) {
	ctx.response.set('Content-Type', 'application/json');
	ctx.body = {
		err    : code || 1,
		errdesc: errdesc
	};
}


//** database
let models    = require("./models/index")(cfg);
global.models = models;
global.log    = console.log;

// REMOVE THIS IN PRODUCTION!
require('./setup');

// REMOVE THIS IN PRODUCTION!


app.use(serve(cfg.dirWeb), {
	format: true
});

app.use(bodyParser());

//** auth
app.keys = ['wr-secret-key'];
app.use(session({}, app));

app.use(async (ctx, next) => {

	ctx.jr = function (d) {
		_jsonResponse(this, d);
	};
	ctx.je = function (d) {
		_jsonError(this, d);
	};
	await next();
});
// app.keys = [cfg.sessionKey];
require('./auth');
let passport = require('koa-passport');
app.use(passport.initialize());
app.use(passport.session());

let authAdmin = require('./controllers/admin/index')(cfg);
app.use(authAdmin.middleware());

let authMember = require('./controllers/members/login')(cfg);
app.use(authMember.middleware());


require('./routes')(router);

app.use(router.routes())
	.use(router.allowedMethods());


let pug = new Pug({
	viewPath    : cfg.dirApp + 'views',
	debug       : true,
	noCache     : cfg.env !== 'production',
	pretty      : false,
	compileDebug: false,
	locals      : {},
	helperPath  : [
		{
			_     : require('lodash'),
			common: lib.common
		}
	],
	app         : app
});


// app.listen(cfg.web.port);
console.log('app listening for modules on port: ', cfg.web.port);

lib.sms    = require('./lib/sms.js')(cfg);
let server = require('http').Server(app.callback());

// Defining traxx service
service.traxx_connection = require('./controllers/service/traxx_service')(cfg, server);
service.traxx_connection.init();
// service.traxx_connection.startBikeData(1,'0586315785');
// service.traxx_connection.stopBikeData(1,'0586315785');


server.listen(cfg.web.port);


/**
 Defining Test unit
 */
// if (!cfg.db.reset) {
// 	(async function () {
// 		try {
// let user = await models.UserValidation.findByPhone(cfg.unitest.user.phone);
// if(!user) {
// 	await models.Device.create({
// 		phone: cfg.unitest.device.phone,
// 		imei : cfg.unitest.device.imei,
// 	});
// 	await models.Bike.create({
// 		model: cfg.unitest.bike.model,
// 		year : cfg.unitest.bike.year,
// 		image: cfg.unitest.bike.image,
// 		name : cfg.unitest.bike.name,
// 	});
//
// 	await models.UserValidation.create({
// 		phone: cfg.unitest.user.phone,
// 		otp  : cfg.unitest.user.otp,
// 		token: cfg.unitest.user.token
// 	});
// 		// }
// 		console.log("Running Test ---------------------");
// 		require('./unitest/index')(cfg);
// 	} catch (e) {
// 		console.log(e);
// 	}
// })();

//}
// lib.concox = require("./lib/concox-handler");