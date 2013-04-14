(function () {
    "use strict";

    var vows = require('vows');
    var assert = require('assert');
    var murmurhash = require('murmurhash');

    var ActiveRecord = require('../lib/dynamodb-activerecord').ActiveRecord;

    var metadata = {
        tablename : "test",
        hashkey: "id",
        versionkey: "version",
        properties: {
            id : {
                type : "N"
            },
            name : {
                type : "S"
            },
            status : {
                type : "N",
                default: 1
            }
        }
    };

    var obj = {
        name: "name"
    };

    vows.describe('ActiveRecord Objects').addBatch({

        "A new active record object": {
            topic :  new ActiveRecord( obj, metadata),
            "should have the proper methods defined": function (topic)
            {
                assert.isFunction(topic.save);
                assert.isFunction(topic.delete);
                assert.isFunction(topic.get);
                assert.isFunction(topic.patch);
            },
            "should have the proper values defined" : function(topic) {
                assert.equal(JSON.stringify(topic._metadata),  murmurhash.v3(JSON.stringify(metadata)));
                assert.equal(topic.name, "name");
            },
            "should setup default value for version property if versionkey passed without property": function(topic) {
                assert.equal(topic._getmetadata().versionkey, "version");
                assert.equal(topic._getmetadata().properties["version"].default, 1);
                assert.equal(topic._getmetadata().properties["version"].type, "N");
            },
            "if version property passed" : {
                topic :  new ActiveRecord( obj, {tablename : "test", hashkey: "id", versionkey: "version", properties: { version : { type : "D" }}}),
                "should honor passed version property" : function(topic) {
                    assert.equal(topic._getmetadata().versionkey, "version");
                    assert.equal(topic._getmetadata().properties["version"].type, "D");
                }
            },
            "if hashkey passed without related property" : {
                topic :  new ActiveRecord( obj, {tablename : "test", hashkey: "id"}),
                "default property created" : function(topic) {
                    assert.equal(topic._getmetadata().hashkey, "id");
                    assert.equal(topic._getmetadata().properties.id.type, "S");
                }
            },
            "if hashkey passed with related property" : {
                topic :  new ActiveRecord( obj, {tablename : "test", hashkey: "id", properties : { id: { type: "N" }}}),
                "passed property is honored" : function(topic) {
                    assert.equal(topic._getmetadata().hashkey, "id");
                    assert.equal(topic._getmetadata().properties.id.type, "N");
                }
            },
            "if rangekey passed without related property" : {
                topic :  new ActiveRecord( obj, {tablename : "test", hashkey: "id", rangekey: "createdon"}),
                "default property created" : function(topic) {
                    assert.equal(topic._getmetadata().rangekey, "createdon");
                    assert.equal(topic._getmetadata().properties.createdon.type, "S");
                }
            },
            "if rangekey passed with related property" : {
                topic :  new ActiveRecord( obj, {tablename : "test", hashkey: "id", rangekey: "createdon", properties : { createdon: { type: "N" }}}),
                "passed property is honored" : function(topic) {
                    assert.equal(topic._getmetadata().rangekey, "createdon");
                    assert.equal(topic._getmetadata().properties.createdon.type, "N");
                }
            }

        },
        "An active record object should translate value" :  {
            topic :  new ActiveRecord( obj, metadata),
            "to string" : {
                "from string" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type:"S"}, "teststring"), {"S" : "teststring"});
                },
                "from number" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type:"S"}, 122), {"S" : "122"});
                },
                "from date" : function(topic)
                {
                    var d = new Date();
                    assert.deepEqual(topic._generateddbvalue({type:"S"}, d), {"S" : d.toString()});
                },
                "from bool" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type: "S"}, true), {"S" : "true"});
                    assert.deepEqual(topic._generateddbvalue({type: "S"}, false), {"S" : "false"});
                },
                "from object" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type: "S"}, {name : "myname"}), {"S" : JSON.stringify({name : "myname"})});
                }
            },
            "to number" : {
                "from string" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type:"N"}, "122"), {"N" : "122"});
                },
                "from number" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type:"N"}, 122), {"N" : "122"});
                },
                "from date" : function(topic)
                {
                    var d = new Date();
                    assert.deepEqual(topic._generateddbvalue({type:"N"}, d), {"N" : d.getTime().toString()});
                },
                "from bool" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type: "N"}, true), {"N" : "1"});
                    assert.deepEqual(topic._generateddbvalue({type: "N"}, false), {"N" : "0"});
                }
            },
            "to number array" : {
                "from strings" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type:"NS"}, ["122", "133", "9"]), {"NS" : ["122", "133", "9"]});
                }
            },
            "to date" : {
                "from string" : function(topic)
                {
                    var d = new Date();
                    assert.deepEqual(topic._generateddbvalue({type:"D"}, d.toISOString()), {"N" : d.getTime().toString()});
                },
                "from number" : function(topic)
                {
                    var d = new Date();
                    assert.deepEqual(topic._generateddbvalue({type:"D"}, d.getTime()), {"N" : d.getTime().toString()});
                },
                "from date" : function(topic)
                {
                    var d = new Date();
                    assert.deepEqual(topic._generateddbvalue({type:"D"}, d), {"N" : d.getTime().toString()});
                }
            },
            "to boolean" : {
                "from string" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type:"BO"}, "true"), {"N" : "1"});
                    assert.deepEqual(topic._generateddbvalue({type:"BO"}, "false"), {"N" : "0"});
                    assert.deepEqual(topic._generateddbvalue({type:"BO"}, "dsadsadsadsdsas"), {"N" : "0"});
                },
                "from number" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type:"BO"}, 1), {"N" : "1"});
                    assert.deepEqual(topic._generateddbvalue({type:"BO"}, 0), {"N" : "0"});
                    assert.deepEqual(topic._generateddbvalue({type:"BO"}, 99), {"N" : "0"});
                },
                "from boolean" : function(topic)
                {
                    assert.deepEqual(topic._generateddbvalue({type:"BO"}, true), {"N" : "1"});
                    assert.deepEqual(topic._generateddbvalue({type:"BO"}, false), {"N" : "0"});
                }
            },
            "to object" : function(topic){
                assert.deepEqual(topic._generateddbvalue({type:"O"}, {name: "name", status: 1}), {"S" : JSON.stringify({name: "name", status: 1})});
            }
        },
        "An active record object should throw exceptions" :  {
            "when missing metadata" : function()
            {
                assert.throws(function() { new ActiveRecord( obj);});
            },
            "when metadata missing tablename" : function()
            {
                assert.throws(function() { new ActiveRecord( obj, { hashkey: "id" }); });
            },
            "when metadata missing hashkey" : function()
            {
                assert.throws(function() { new ActiveRecord( obj, { tablename: "tablename" }); });
            }
        },
        "An active record object's metadata" :  {
            topic :  new ActiveRecord( obj, metadata),
            " should be properly cached" : function(topic)
            {
                assert.equal(topic._getmetadata().tablename, "test");
            }
        },
        "When a DynamoDb Request Object for a new object is requested" : {
            "and id and version are only passed as keys and not as properties" : {
                topic: function() {
                    var ar = new ActiveRecord({ name: "testname"}, {tablename : "test", hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}});
                    return ar._generateddbrequestobject()
                 },
                "should properly assign a tablename": function(topic) {
                    assert.equal(topic.TableName, "test");
                },
                "should properly populate the name when passed" : function(topic) {
                    assert.equal(topic.Item.name.S, "testname");
                },
                "should properly populate the status default value" : function(topic) {
                    assert.equal(topic.Item.status.N, "1");
                },
                "should properly populate the id and the version" : function(topic) {
                    assert.equal(topic.Item.version.N, "1");
                    assert(topic.Item.id.S.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i));
                }
            },
            "and id value and property defaults are overridden" : {
                topic: function() {
                    var ar = new ActiveRecord({ name: "testname", status: 2}, {tablename : "test", hashkey: "id", versionkey: "version",  properties: { id: { type: "N"},  name : { type : "S" }, status : { type : "N",  default: 1 }}});
                    return ar._generateddbrequestobject({newhashkeyvalue:200});
                },
                "should properly assign a tablename": function(topic) {
                    assert.equal(topic.TableName, "test");
                },
                "should properly populate the name when passed" : function(topic) {
                    assert.equal(topic.Item.name.S, "testname");
                },
                "should properly populate the status value with the passed value and not the default value" : function(topic) {
                    assert.equal(topic.Item.status.N, "2");
                },
                "should properly populate the id with newhashkeyvalue" : function(topic) {
                    assert.equal(topic.Item.id.N, "200");
                }
            },
            "and id uuid1 generator is specified" : {
                topic: function() {
                    var ar = new ActiveRecord({ name: "testname"}, {tablename : "test", hashkey: "id", properties: { id: { type: "S", generator: "uuidv1"},  name : { type : "S" }}});
                    return ar._generateddbrequestobject();
                },
                "should properly populate the id with UUIDv1" : function(topic) {
                    assert(topic.Item.id.S.match(/[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i));
                }
            },
            "and id uuid4 generator is specified" : {
                topic: function() {
                    var ar = new ActiveRecord({ }, {tablename : "test", hashkey: "id", properties: { id: { type: "S", generator: "uuidv4"}}});
                    return ar._generateddbrequestobject();
                },
                "should properly populate the id with UUIDv4" : function(topic) {
                    assert(topic.Item.id.S.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i));
                }
            },
            "and id now generator is specified" : {
                topic: function() {
                    var ar = new ActiveRecord({ }, {tablename : "test", hashkey: "id", properties: { id: { type: "N", generator: "now"}}});
                    return ar._generateddbrequestobject();
                },
                "should properly populate the id with a value that is a number with at least 13 digits" : function(topic) {
                    assert(topic.Item.id.N.match(/^[0-9]{13,}$/));
                }
            },
            "and id generator is specified that is a function referring to another value in the passed object" : {
                topic: function() {
                    var ar = new ActiveRecord({ status: 1 }, {tablename : "test", hashkey: "id", properties: { status : { type: "N"}, id: { type: "N", generator: function() { return this.status + 2 }}}});
                    return ar._generateddbrequestobject();
                },
                "should properly populate the id with a value of 3 returned from the generator function" : function(topic) {
                    assert.equal(topic.Item.id.N, "3");
                }
            }
        }
    }).export(module);

}());