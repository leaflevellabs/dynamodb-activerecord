(function () {
    "use strict";

    var assert          = require('assert');

    var aws             = require("aws-sdk");
    var vows            = require("vows");

    var ActiveRecord    = require('../lib/dynamodb-activerecord').ActiveRecord;

    var aws_accesskeyid     = process.env.AWSACCESSKEY,
        aws_region          = process.env.AWSREGION  || "us-east-1",
        aws_tableprefix     = process.env.AWSTABLEPREFIX || "test_",
        aws_secretaccesskey = process.env.AWSSECRETKEY;

    if(!aws_accesskeyid || !aws_secretaccesskey)
    {
        console.log("AWSACCESSKEY and AWSSECRETKEY must be passed as environmental variables in order to execute integration tests.");
        return;
    }

    var dynamodb = new aws.DynamoDB({
        credentials  : new aws.Credentials(aws_accesskeyid, aws_secretaccesskey),
        region : aws_region,
        sslEnabled :  true,
        maxRetries :  3,
    });

    vows.describe('DynamoDb Integration with ActiveRecord Objects').addBatch(
        {
            "when a new record is created " : {
                topic: function() {
                    var self = this;
                    var tblName = aws_tableprefix + "stringhashkeyandversion";
                    var ar = new ActiveRecord({ name: "testname"}, {tablename : tblName, hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}});
                    ar.create(dynamodb.client, function(err, response) {
                        return self.callback(err, response, ar);
                    });
                },
                "the properties should be saved correctly" : function(err, response, ar) {
                    assert.deepEqual(err, null);
                    assert(ar.id.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i));
                    assert.equal(ar.name, "testname");
                    assert.equal(ar.status, 1);
                    assert.equal(ar.version, 1);
                    assert.equal(response.ConsumedCapacityUnits, 1);
                }
            },
            "when a new record is created and then deleted" : {
                topic: function() {
                    var self = this;
                    var tblName = aws_tableprefix + "stringhashkeyandversion";
                    var ar = new ActiveRecord({ name: "testname"}, {tablename : tblName, hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}});
                    ar.create(dynamodb.client, function(err, response) {
                        if(err) return self.callback(err);

                        ar.delete(dynamodb.client, function(err, response) {
                            return self.callback(err, response, ar);
                        });
                    });
                },
                "the responses should be correct" : function(err, response, ar) {
                    assert.deepEqual(err, null);
                    assert(ar._isdeleted);
                    assert(ar._metadata);
                    assert.deepEqual(ar.id, undefined);
                    assert.deepEqual(ar.status, undefined);
                    assert.deepEqual(ar.name, undefined);
                    assert.deepEqual(ar.version, undefined);
                    assert.equal(response.ConsumedCapacityUnits, 1);
                }
            },
            "when a new record is created and then saved again" : {
                topic: function() {
                    var self = this;
                    var tblName = aws_tableprefix + "stringhashkeyandversion";
                    var ar = new ActiveRecord({ name: "testname"}, {tablename : tblName, hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}});
                    ar.create(dynamodb.client, function(err, response) {
                        if(err) return self.callback(err);
                        ar.name = "newname";
                        ar.status = 3;
                        var opts = {getold: true};

                        ar.update(dynamodb.client, opts, function(err, response) {
                            return self.callback(err, response, ar);
                        });
                    });
                },
                "the responses should be correct" : function(err, response, ar) {
                    assert.deepEqual(err, null);
                    assert(!ar._isdeleted);
                    assert(ar._metadata);
                    assert.equal(response.ConsumedCapacityUnits, 1);
                    assert.equal(ar.name, "newname");
                    assert.equal(ar.status, 3);
                    assert.equal(ar.version, 2);
                    assert.equal(response.Attributes.id.S, ar.id);
                    assert.equal(response.Attributes.version.N, "1");
                    assert.equal(response.Attributes.status.N, "1");
                    assert.equal(response.Attributes.name.S, "testname");
                }
            },
            "when a new record is created and then another is created with the same id" : {
                topic: function() {
                    var self = this;
                    var tblName = aws_tableprefix + "stringhashkeyandversion";
                    var ar = new ActiveRecord({ name: "testname"}, {tablename : tblName, hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}});
                    ar.create(dynamodb.client, function(err, response) {

                        if(err) return self.callback(err);

                        var ar2 = new ActiveRecord(
                            { name: "testname2", id: ar.id},
                            {tablename : tblName, hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}}
                        );

                        ar2.create(dynamodb.client, function(err, response) {
                            return self.callback(err, response, ar, ar2);
                        });
                    });
                },
                "the responses should be correct" : function(err, response, ar, ar2) {
                    assert.equal(err.code, "ConditionalCheckFailedException");
                }
            },
            "when a new record is created and then loaded" : {
                topic: function() {
                    var self = this;
                    var tblName = aws_tableprefix + "stringhashkeyandversion";
                    var ar = new ActiveRecord({ name: "testname"}, {tablename : tblName, hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}});
                    ar.create(dynamodb.client, function(err, response) {
                        if(err) return self.callback(err);
                        var ar2 = new ActiveRecord({ }, {tablename : tblName, hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}});
                        ar2.load(dynamodb.client, { hashkeyvalue : ar.id }, function(err, response) {
                            return self.callback(err, response, ar2);
                        });
                    });
                },
                "the responses should be correct" : function(err, response, arresult) {
                    assert.deepEqual(err, null);
                    assert.equal(arresult.version, 1);
                    assert.equal(arresult.status, 1);
                    assert.equal(arresult.name, "testname");

                }
            }
        }
    ).export(module);



}());
