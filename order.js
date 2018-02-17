"use strict";

let router = require('koa-router')();
const moment = require('moment');

router.get('/get/:id([0-9]+)', async function (ctx) {
	let id = parseInt(ctx.params.id);

	let entity = await models.Order.findById(id);
	if (!entity) {
		return ctx.je("Invalid id");
	}
	ctx.jr({
		entity: entity.toJSON()
	});

});


router.get('/getList', async function (ctx) {

	let page = parseInt(ctx.query.page);
	if (page < 0) {
		return ctx.je("Invalid page");
	}
	let pageSize = parseInt(ctx.query.page_size);
	if (pageSize <= 0) {
		return ctx.je("Invalid pageSize");
	}

	let clientId = parseInt(ctx.query.client_id);

	let keyword = ctx.query.keyword;
	let $where = {};
	if (clientId) {
		$where.client_id = clientId;
	}
	if (keyword) {
		$where.$or = [
			{id: {$like: "%" + keyword + "%"}}
		];
	}
	let result = await models.Order.findAndCountAll({
		limit: pageSize,
		offset: (page - 1) * pageSize,
		where: $where,
		include: [
			{
				model: models.Client,
				as: 'client'
			}
		]
	});
	let records = [];
	for (let i = 0; i < result.rows.length; i++) {
		let r = result.rows[i].toJSON();
		records.push(r);
	}

	ctx.jr({
		records: records,
		total: result.count
	});

});


router.post('/save', async function (ctx) {

	let id = ctx.request.body.id;
	let entity;
	if (id > 0) {
		entity = await models.Order.findById(id);
	} else {
		entity = models.Order.build({
			id: 0
		});
	}
	entity.client_id = ctx.request.body.client_id;
	entity.package_comments = ctx.request.body.package_comments;
	entity.comments = ctx.request.body.comments;
	entity.delivery_lat = ctx.request.body.delivery_lat;
	entity.delivery_lng = ctx.request.body.delivery_lng;
	entity.delivery_address = ctx.request.body.delivery_address;

	entity.package_type1 = ctx.request.body.package_type1;
	entity.package_size1 = ctx.request.body.package_size1;
	entity.package_type2 = ctx.request.body.package_type2;
	entity.package_size2 = ctx.request.body.package_size2;
	entity.package_type3 = ctx.request.body.package_type3;
	entity.package_size3 = ctx.request.body.package_size3;

	entity = await entity.save();

	ctx.jr({
		entity: entity.toJSON()
	});
});


router.post('/delete', async function (ctx) {
	let id = ctx.request.body.id;
	let entity = await models.Order.findById(id);
	if (!entity) {
		return ctx.je("Invalid id");
	}
	await entity.destroy();

	ctx.jr();
});


router.get('/getAlerts', async function (ctx) {

	let page = +ctx.query.page;
	if (page < 0) {
		return ctx.je("Invalid page");
	}
	let pageSize = parseInt(ctx.query.page_size);
	if (pageSize <= 0) {
		return ctx.je("Invalid pageSize");
	}
	let keyword = ctx.query.keyword;

	let result = await models.sequelize.query("SELECT o1.id, o1.issue_date, o2.id AS id2, o2.issue_date AS issue_date2 FROM `order` AS `o1` LEFT JOIN `order` AS `o2` ON (`o1`.`client_id` = `o2`.`client_id`) AND (o1.id > o2.id AND TIMESTAMPDIFF(MONTH, o1.issue_date, o2.issue_date) = 0) WHERE o1.issue_date IS NOT NULL AND o2.issue_date IS NOT NULL");

	result = result.map(function (x) {
		return x[0];
	});

	ctx.jr({
		records: result,
		total: result.length
	});
});


router.get('/getByClient', async function (ctx) {

	let page = +ctx.query.page;
	if (page < 0) {
		return ctx.je("Invalid page");
	}
	let pageSize = parseInt(ctx.query.page_size);
	if (pageSize <= 0) {
		return ctx.je("Invalid pageSize");
	}
	let keyword = ctx.query.keyword;

	let clientId = +ctx.query.client_id;
	if (!clientId) {
		return ctx.je('invalid params');
	}

	let $where = {
		client_id: clientId
	};
	if (keyword) {
		$where.$or = [
			{id: {$like: "%" + keyword + "%"}},
			{package_comments: {$like: "%" + keyword + "%"}},
		];
	}

	let result = await models.Order.findAndCountAll({
		limit: pageSize,
		offset: (page - 1) * pageSize,
		where: $where,
		include: [
			{
				model: models.Client,
				as: 'client'
			}
		]
	});

	let records = [];
	for (let i = 0; i < result.rows.length; i++) {
		let r = result.rows[i].toJSON();
		records.push(r);
	}

	ctx.jr({
		records: records,
		total: result.count
	});
});


router.post('/preAddClientCheck', async function (ctx) {

	let client_id = +ctx.request.body.client_id;
	if (!client_id) {
		return ctx.je('פרמטרים חסרים');
	}

	try {
		let orders = await models.Order.findAll({
			attributes: ['id', 'client_id', 'issue_date', 'delivery_address'],
			where: {
				status: 1, // only active
				client_id: client_id,
				issue_date: {
					$between: [moment().subtract(27, 'days').format('YYYY-MM-DD'), moment().add(1, 'months').format('YYYY-MM-DD')]
				}
			},
			include: [
				{
					model: models.Client,
					as: 'client',
					attributes: ['id', 'full_name', 'first_name', 'last_name'],
					required: false
				},
				{
					model: models.DeliveryLine,
					as: 'deliveryLine',
					attributes: ['id', 'name'],
					required: false
				},
			]
		});

		return ctx.jr({
			orders: orders
		})

	} catch (e) {
		return ctx.je('קרתה תקלה');
	}

});


router.post('/updateRouteOrder', async function (ctx) {

	let order_ids = ctx.request.body.orders;
	if (!order_ids) {
		return ctx.je('פרמטרים חסרים');
	}

	// records come ordered after ui-sortable
	try {
		for (let i = 0; i < order_ids.length; i++) {
			if (order_ids[i]) {
				let order = await models.Order.findById(+order_ids[i]);
				order.update({
					route_order: i + 1
				});
			}
		}

		return ctx.jr();

	} catch (e) {
		return ctx.je('קרתה תקלה');
	}

});


// router.post('/setLocationGeometry', async function (ctx) {
//
// 	let id = +ctx.request.body.id;
// 	let lat = parseFloat(ctx.request.body.lat);
// 	let lng = parseFloat(ctx.request.body.lng);
// 	let formatted_address = ctx.request.body.formatted_address;
//
// 	try {
// 		let entity = await models.Order.findById(id);
// 		if (!entity) {
// 			return ctx.je('order couldn\'t be found');
// 		}
// 		entity.delivery_lat = lat;
// 		entity.delivery_lng = lng;
// 		entity.delivery_address = formatted_address;
//
// 		entity = await entity.save();
//
// 		return ctx.jr({
// 			lat: entity.latitude,
// 			lng: entity.longitude,
// 		});
//
// 	} catch (e) {
// 		console.log(e);
// 		return ctx.je(e);
// 	}
// });
//
//
// router.get('/getOptions', async function(ctx){
//
// 	let options = await models.Order.findAll({
// 		attributes: [
// 			['id', 'v'],
// 			['concat(first_name," ", last_name)', 't']
// 		],
// 		order     : [
// 			['id', 'ASC']
// 		]
// 	});
//
// 	ctx.jr({
// 		options: options
// 	});
// });


module.exports = router;