"use strict";

let router = require('koa-router')();


//TODO : Change to a specific message
const OTP_MESSAGE        = "your validation code is :",
	  FORGOT_PIN_SUBJECT = "Reset pin number",
	  FORGOT_PIN_CONTENT = "Click on the like to reset your pin : ",
	  RESET_PIN_PATH     = 'site/reset_pin/';


/**
 * @method getAppUser
 * @param token
 *
 * @type: Get
 * This function get the app user with the specific token
 */
router.get('/getAppUser', async (ctx) => {
	try {
		let token  = ctx.query.token;
		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid Token");
		}

		ctx.jr({
			user: entity.toJSON()
		})

	} catch (e) {
		ctx.je(e);
	}
});


/**
 * @method initialRegistration
 * @param phone
 * @return {userValidationId}
 * @type: Post
 * This function creates a validation user entity
 * and sends an sms message with OTP password
 */
router.post('/initialRegistration', async (ctx) => {


	let phone = ctx.request.body.phone;
	let entity;


	try {

		// /**
		//  * For Testing !!!
		//  */
		// if (cfg.unitest && cfg.unitest.user && phone === cfg.unitest.user.phone) {
		// 	let user = await  models.UserValidation.findByPhone(phone);
		// 	return ctx.jr({
		// 		validation_token: user.token
		// 	});
		// }

		phone            = lib.common.cleanPhone(phone);
		let isValidPhone = lib.common.isPhoneValid(phone);
		if (!isValidPhone) {
			return ctx.je("Phone number is not valid");
		}
		if (!phone) {
			return ctx.je('Could not find user phone')
		}

		entity = await models.AppUser.findByPhone(phone);
		if (!entity) {
			entity = await models.UserValidation.findByPhone(phone);
		}
		let otp = lib.common.generateOtp();

		if (!entity) {
			entity = await models.UserValidation.create({
				phone: phone,
			});
			await entity.generateToken();
		}
		entity.otp = otp;
		await lib.sms.send(phone, OTP_MESSAGE + otp);
		await entity.save();

		ctx.jr({
			token: entity.token,
		});
	} catch (e) {
		console.log(e);
		return ctx.je(e);
	}
});


/**
 * @method ValidateUser
 * @param validation_id
 * @param OTP
 * @return {userValidationId}
 *
 *  @type: Post
 *
 * This function checks is the OTP is correct
 * and updates the is_verified attribute
 * This method deals with new and existing users
 */
router.post('/validateRegistration', async (ctx) => {
	let token = ctx.request.body.token;
	let otp   = ctx.request.body.otp;
	let entity;

	// /**
	//  * For Testing !!
	//  */
	// if (token === cfg.unitest.user.token) {
	// 	return ctx.jr({
	// 		token: cfg.unitest.user.token
	// 	});
	// }

	try {

		entity = await models.AppUser.findByToken(token);
		if (!entity) {
			entity = await models.UserValidation.findByToken(token);
		}

		if (!entity) {
			return ctx.je('User token is invalid');
		}

		if (otp !== entity.otp) {
			return ctx.je('User OTP is incorrect');
		}

		if (entity instanceof models.UserValidation) {
			entity = await models.AppUser.create({
				is_verified: true,
				phone      : entity.phone,
				otp        : otp
			});
			await entity.generateToken();
		}

		console.log(entity.toJSON());

		await entity.save();
		ctx.jr({
			token: entity.token
		});
	} catch (e) {
		console.log(e);
		return ctx.je(e);
	}
});


/**
 * @method completeRegistration
 * @param avatar
 * @param name
 * @param pin
 * @param platform
 * @param type
 * @param lng
 * @param lat
 * @return {AppUser}
 *
 * @type: Post
 * This function complete the registration if
 * the device is not paired to another phone
 * if the device is already paired a message will be sent
 * to the device owner
 */
router.post('/completeRegistration', async (ctx) => {

	let token    = ctx.request.body.token;
	let avatar   = ctx.request.body.avatar;
	let name     = ctx.request.body.name;
	let email    = ctx.request.body.email;
	let lat      = ctx.request.body.lat;
	let lng      = ctx.request.body.lng;
	//TODO : units will be determent by his lat lng( us imperial other metric)
	let units    = ctx.request.body.units;
	let language = ctx.request.body.language;
	// let msisdn   = ctx.request.body.msisdn;
	let platform = ctx.request.body.platform;
	let phone    = ctx.request.body.phone;


	// /**
	//  * For Testing !!
	//  */
	// if (token === cfg.unitest.user.token) {
	// 	let user = await models.AppUser.create({
	// 		name    : name,
	// 		phone   : phone,
	// 		otp     : cfg.unitest.user.otp,
	// 		token   : token,
	// 		pin     : pin,
	// 		type    : 'guest',
	// 		platform: platform,
	// 		lat     : lat,
	// 		lng     : lng,
	// 		units   : units,
	// 		language: language,
	// 		email   : email
	// 	});
	// 	return ctx.jr({
	// 		user: user
	// 	});
	// }
	try {
		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je('User token is invalid');
		}

		if (!entity.is_verified) {
			return ctx.je('User was not verified');
		}

		// Create a expiration_date  for the user
		let d               = new Date(), year = d.getFullYear(), month = d.getMonth(), day = d.getDate();
		let expiration_date = new Date(year + 2, month, day);

		// TODO : set the units type by location usa imperial other metric(use google maps api)
		entity.name           = name;
		entity.avatar         = avatar;
		// entity.msisdn         = msisdn;
		entity.is_verified    = true;
		entity.account_status = 'active';
		entity.records_rides  = true;
		entity.type           = 'guest';
		entity.units          = units;
		entity.language       = language;
		entity.platform       = platform;
		entity.lng            = lng;
		entity.lat            = lat;
		entity.licence_exp    = expiration_date;
		entity.email          = email;
		await entity.save();


		// Sets the user bike and traxx device
		await entity.save();

		ctx.jr({
			user: entity.toJSON()
		});
	} catch (e) {
		console.log(e);
		ctx.je(e);
	}
});

/**
 * @method changeAccountStatus
 * @param token
 *
 * @type: Post
 * This function changes the account status
 */
router.post('/changeAccountStatus', async (ctx) => {
	try {
		let token  = ctx.request.body.token;
		let status = ctx.request.body.status;
		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid user id");
		}
		entity.account_status = status;
		await entity.save();

		ctx.jr({
			user: entity.toJSON()
		})
	} catch (e) {
		ctx.je(e)
	}
});


/**
 * @method displayRides
 * @param token
 *
 * @type: Post
 * This function change display drives option
 */
router.post('/displayRides', async (ctx) => {
	try {
		let token  = ctx.request.body.token;
		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid user id");
		}
		entity.display_rides = !entity.display_rides;
		await entity.save();

		ctx.jr({})
	} catch (e) {
		ctx.je(e)
	}
});


/**
 * @method displayAlerts
 * @param token
 *
 * @type: Post
 * This function change alert display
 */
router.post('/displayAlerts', async (ctx) => {
	try {
		let token  = ctx.request.body.token;
		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid user id");
		}
		entity.display_alerts = !entity.display_alerts;
		await entity.save();

		ctx.jr({})
	} catch (e) {
		ctx.je(e)
	}
});


/**
 * @method changePinNumber
 * @param token
 *
 * @type: Post
 * This function change pin number
 */
router.post('/changePinNumber', async (ctx) => {
	try {
		let token   = ctx.request.body.token;
		let new_pin = ctx.request.body.new_pin;
		let pin     = ctx.request.body.old_pin;
		console.log(ctx.request.body);
		let entity = await models.AppUser.findByToken(token);

		if (!entity) {
			return ctx.je("Invalid user token");
		}

		if (pin !== entity.pin) {
			return ctx.je("Pin number is incorrect")
		}

		entity.pin = new_pin;
		await entity.save();

		ctx.jr({})
	} catch (e) {
		console.log(e);
		ctx.je(e)
	}
});


/**
 * @method setPinNumber
 * @param token
 * @param pin
 *
 * @type: Post
 * This function changes pin number
 */
router.post('/setPinNumber', async (ctx) => {
	try {
		let token = ctx.request.body.token;
		let pin   = ctx.request.body.pin;
		console.log(ctx.request.body);
		let entity = await models.AppUser.findByToken(token);

		if (!entity) {
			return ctx.je("Invalid user token");
		}


		entity.pin = pin;
		await entity.save();

		ctx.jr({})
	} catch (e) {
		console.log(e);
		ctx.je(e)
	}
});


/**
 * @method verifyPinNumber
 * @param token
 * @param pin
 *
 * @type: Post
 * This function verifies pin number
 */
router.post('/verifyPinNumber', async (ctx) => {
	try {
		let token = ctx.request.body.token;
		let pin   = ctx.request.body.pin;
		console.log(ctx.request.body);
		let entity = await models.AppUser.findByToken(token);

		if (!entity) {
			return ctx.je("Invalid user token");
		}

		if (entity.pin !== pin) {
			return ctx.je("Invalid pin number");
		}

		ctx.jr({})
	} catch (e) {
		console.log(e);
		ctx.je(e)
	}
});


/**
 * @method forgotPinNumber
 * @param token
 *
 * @type: Post
 * This function sends a link to the user with a link
 * To change his pin number
 */
router.post('/forgotPinNumber', async (ctx) => {
	try {
		let token  = ctx.request.body.token;
		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid user id");
		}
		let confirmation_path = cfg.web.base_url + RESET_PIN_PATH + token;
		let message           = FORGOT_PIN_CONTENT + confirmation_path;
		console.log(message, entity.email);
		lib.email.send(FORGOT_PIN_SUBJECT, message, entity.email);
		ctx.jr({});
	} catch (e) {
		ctx.je(e)
	}
});

/**
 * @method updateProfile
 * @param token
 * @param name
 * @param image
 *
 *
 * @type: Post
 * This function updates user profile
 */
router.post('/updateProfile', async (ctx) => {
	try {
		let token  = ctx.request.body.token;
		let name   = ctx.request.body.name;
		let avatar = ctx.request.body.avatar;
		let entity = await models.AppUser.findByToken(token);
		console.log(avatar, name);
		if (!entity) {
			return ctx.je("Invalid id");
		}
		if (name === '') {
			return ctx.je('User name could not be empty')
		}
		entity.name   = name;
		entity.avatar = avatar;
		await entity.save();
		ctx.jr({
			user: entity.toJSON()
		});
	} catch (e) {
		ctx.je(e);
	}
});


/**
 * @method changeLanguage
 * @param token
 * @param language
 *
 * @type: Post
 * This function changes the app language
 */
router.post('/changeLanguage', async (ctx) => {
	try {
		let language = ctx.request.body.language;
		let token    = ctx.request.body.token;
		console.log(token, language);
		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid user token");
		}

		entity.language = language;
		await entity.save();
		ctx.jr({})
	} catch (e) {
		ctx.je(e)
	}
});


/**
 * @method connectWithFacebook
 * @param fb_uid
 * @param token
 *
 * @type: Post
 * This function create a new user or return an existing user
 */
router.post('/connectWithFacebook', async (ctx) => {
	try {
		let fb_id           = ctx.request.body.fb_uid;
		let fb_access_token = ctx.request.body.fb_access_token;
		let token           = ctx.request.body.token;
		let entity          = await models.AppUser.findByToken(token);

		if (!entity) {
			return ctx.je("Invalid Token");
		}

		entity.fb_uid          = fb_id;
		entity.fb_access_token = fb_access_token;
		entity.save();
		ctx.jr({})
	} catch (e) {
		console.log(e);
		ctx.je(e);
	}
});


/**
 * @method updateFacebookFriends
 * @param token
 *
 * @type: Post
 * This function create a new user or return an existing user
 */
router.get('/getFacebookFriends', async (ctx) => {
	try {
		console.log('/getFacebookFriends');
		let contacts = [];
		let fb_uids  = ctx.query.fb_ids;
		let token    = ctx.query.token;
		let entity   = await models.AppUser.findByToken(token);
		console.log(token, fb_uids);
		if (!entity.fb_uid) {
			return ctx.je("You are not connected through facebook");
		}

		/**
		 *
		 * For presentation uncomment this in production
		 */

		if (fb_uids) {
			fb_uids  = JSON.parse(fb_uids);
			contacts = await models.AppUser.findAll({
				where: {
					fb_uid: {
						$in: fb_uids
					}
				}
			});
		}
		console.log(contacts);
		ctx.jr({
			contacts: contacts.length > 0 ? models.AppUser.getJSONContactsList(contacts) : []
		});
	} catch (e) {
		console.log(e);
		ctx.je(e);
	}
});

/**
 * @method saveSOSContact
 * @param token
 * @param contact_id
 *
 *
 * @type: Post
 * This function saves a new contact for that user
 */
router.post('/saveSOSContact', async (ctx) => {
	try {
		let contact_id = +ctx.request.body.contact_id;
		let token      = ctx.request.body.token;
		let entity     = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid Token");
		}
		let contact = await models.AppUser.findById(contact_id);
		if (!contact) {
			return ctx.je("Could not find the requested contact");
		}
		await entity.setContact(contact);
		await contact.addGuardian(entity);

		ctx.jr({});
	} catch (e) {
		console.log(e);
		ctx.je(e);
	}
});


/**
 * @method getSOSContact
 * @param token
 *
 *
 * @type: Get
 * This function gets all app user contacts
 */
router.get('/getGuardianUsers', async (ctx) => {
	try {
		console.log(ctx.query);
		let token = ctx.query.token;

		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid id");
		}
		let contacts = await entity.getGuardian();
		console.log(contacts);
		ctx.jr({
			contacts: models.AppUser.getJSONList(contacts)
		});
	} catch (e) {
		console.log(e);
		ctx.je(e);
	}
});


/**
 * @method deleteSOSContact
 * @param token
 * @param contact_id
 *
 *
 * @type: Post
 * This function delete sos contact
 */
router.post('/deleteSOSContact', async (ctx) => {
	try {
		let contact_id = +ctx.request.body.contact_id;
		let token      = ctx.request.body.token;
		let entity     = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid id");
		}
		let contact = await entity.getContact();
		if (!contact) {
			return ctx.je("Could not find the requested contact");
		}
		contact = await models.AppUser.findById(contact_id);
		await entity.setContact(null);
		await contact.removeGuardian(entity);
		ctx.jr({});
	} catch (e) {
		console.log(e);
		ctx.je(e)
	}
});


/**
 * @method getContactDetails
 * @param token
 * @param contact_id
 *
 * @type: Get
 * This function find get contact details
 */
router.get('/getContactDetails', async (ctx) => {
	try {
		let token  = ctx.query.token;
		let entity = await models.AppUser.findByToken(token);
		if (!entity) {
			return ctx.je("Invalid id");
		}
		let contact = await entity.getContact();
		if (!contact) {
			return ctx.je("That user has not contact");
		}

		let contact_bike = await contact.getBike();

		ctx.jr(
			{
				contact: {
					name: contact.name
				},
				bike   : {
					model: contact_bike ? contact_bike.model : "This contact has no Bike"
				}
			}
		);
	} catch (e) {
		console.log(e);
		ctx.je(e);
	}
});

/**
 * @method setPushToken
 * @param token
 * @param pin
 *
 * @type: Post
 * This function set the user push token
 */
router.post('/setPushToken', async (ctx) => {
	try {
		let token      = ctx.request.body.token;
		let push_token = ctx.request.body.push_token;
		console.log(ctx.request.body);
		let entity = await models.AppUser.findByToken(token);

		if (!entity) {
			return ctx.je("Invalid user token");
		}


		entity.push_token = push_token;
		await entity.save();

		ctx.jr({})
	} catch (e) {
		console.log(e);
		ctx.je(e)
	}
});


// TODO : This function is only for testing until we will be able to know when the app user is connected via bluetooth
/**
 * @method connectedToApp
 * @param token
 * @param pin
 *
 * @type: Post
 * This function set the user push token
 */
router.post('/connectedToApp', async (ctx) => {
	try {
		let token     = ctx.request.body.token;
		let is_online = ctx.request.body.is_online;
		console.log(ctx.request.body);
		let entity = await models.AppUser.findByToken(token);

		if (!entity) {
			return ctx.je("Invalid user token");
		}

		let device = await entity.getDevice();
		if (device) {
			if (is_online) {
				service.traxx_connection.startBikeData(entity.id, device.phone);
			}
			else {
				service.traxx_connection.stopBikeData(entity.id, device.phone);

			}
		}

		entity.is_online = is_online;
		await entity.save();
		ctx.jr({})
	} catch (e) {
		console.log(e);
		ctx.je(e)
	}
});


/**
 * @method setPushToken
 * @param token
 * @param pin
 *
 * @type: Post
 * This function changes pin number
 */
router.post('/setBluetoothConnection', async (ctx) => {
	try {
		let token                = ctx.request.body.token;
		let bluetooth_connection = ctx.request.body.bluetooth_connection;
		console.log(ctx.request.body);
		let entity = await models.AppUser.findByToken(token);

		if (!entity) {
			return ctx.je("Invalid user token");
		}


		entity.bluetooth_connectioned = bluetooth_connection;
		await entity.save();

		ctx.jr({})
	} catch (e) {
		console.log(e);
		ctx.je(e)
	}
});


/**
 * Options Functions
 */


router.get('/getLanguages', async (ctx) => {

	ctx.jr({
		language: models.AppUser.getLanguages()
	});
});


router.get('/getOptions', async (ctx) => {

	ctx.jr({
		options: models.AppUser.getOptions()
	});
});


module.exports = router;