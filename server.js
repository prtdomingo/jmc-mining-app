var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    MongoClient = require('mongodb').MongoClient,
    engines = require('consolidate'),
    assert = require('assert'),
    ObjectId = require('mongodb').ObjectID,
    keyVault = require('./keyvault'),
    paginate = require('express-paginate'),
    redis = require('redis'),
    appInsights = require("applicationinsights");

keyVault.appInsightsKey().then(function (instrumentKey) {    
    appInsights.setup(instrumentKey);
    appInsights.start();    
});

app.use(express.static(__dirname + "/public"));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(paginate.middleware(10, 50));

app.all(function (req, res, next) {
    // set default or minimum is 10 (as it was prior to v0.2.0)
    if (req.query.limit <= 10) req.query.limit = 10;
    next();
});

app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

function errorHandler(err, req, res, next) {
    console.error(err.message);
    console.error(err.stack);
    res.status(500).render("error_template", { error: err});
}

keyVault.redisCacheConnectionString().then(function (redisConnection) {
    var client = redis.createClient(6380, process.env.REDIS_CACHE_HOST,
        {auth_pass: redisConnection, tls: {servername: process.env.REDIS_CACHE_HOST}});

    var currentPage = 'page1';

    keyVault.cosmosDbConnectionString().then(function (result) {
        MongoClient.connect(process.env.MONGODB_URI || result, function (err, db) {
            var records_collection = db.collection('records');

            app.get('/records', (req, res, next) => {
                currentPage = 'page' + req.query.page;
                client.get(currentPage, function (error, reply) {
                    if (error) throw err;

                    if (reply) {
                        console.log('get cache');
                        res.json(JSON.parse(reply));
                    } else {
                        records_collection.count(function (err, totalCount) {
                            records_collection.find({}).limit(req.query.limit).skip(req.skip).toArray(function (err, records) {
                                if (err) throw err;

                                if (records.length < 1) {
                                    console.log("No records found.");
                                }

                                var pageCount = Math.ceil(totalCount / req.query.limit);

                                var response = {
                                    object: 'list',
                                    currentPage: req.query.page,
                                    pages: paginate.getArrayPages(req)(10000, pageCount, req.query.page),
                                    data: records
                                };

                                client.set(currentPage, JSON.stringify(response), function() {
                                    res.json(response);
                                    console.log('set cache');
                                });
                            });
                        });
                    }
                });
            });

            app.post('/records', function (req, res, next) {
                console.log(req.body);
                records_collection.insert(req.body, function (err, doc) {
                    if (err) throw err;
                    console.log(doc);
                    client.del(currentPage); // quick hack because we procastinated on doing this >:(
                    res.json(doc);
                });
            });

            app.delete('/records/:id', function (req, res, next) {
                var id = req.params.id;
                console.log("delete " + id);
                records_collection.deleteOne({ '_id': new ObjectId(id) }, function (err, results) {
                    console.log(results);
                    client.del(currentPage);
                    res.json(results);
                });
            });

            app.put('/records/:id', function (req, res, next) {
                var id = req.params.id;
                records_collection.updateOne(
                    { '_id': new ObjectId(id) },
                    {
                        $set: {
                            'name': req.body.name,
                            'email': req.body.email,
                            'phone': req.body.phone
                        }
                    }, function (err, results) {
                        console.log(results);
                        client.del(currentPage);
                        res.json(results);
                    });
            });

            app.use(errorHandler);
            var server = app.listen(process.env.PORT || 1338, function () {
                var port = server.address().port;
                console.log('Express server listening on port %s.', port);
            })
        })
    });
});