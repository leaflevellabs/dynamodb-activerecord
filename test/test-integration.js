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
                    var callback = this.callback();
                    var tblName = aws_tableprefix + "stringhashkeyandversion";
                    var ar = new ActiveRecord({ name: "testname"}, {tablename : tblName, hashkey: "id", versionkey: "version",  properties: { name : { type : "S" }, status : { type : "N",  default: 1 }}});
                    ar.save(dynamodb.client, function(err, data) {
                        console.log(err, data)
                        this.callback(err, data);
                    });


                },
                "the default properties should be saved correctly" : function(err, result) {
                    console.log(err, result);
                }
            }
        }
    ).export(module);



}());
