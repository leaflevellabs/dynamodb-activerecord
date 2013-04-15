##dynamodb-activerecord

This is an active record implementation for Amazon's DynamoDb.

## Installation via npm

``` sh
  $ npm install dynamodb-activerecord
```
## Sample Usage (upsert one record)
``` js
  var aws-sdk = require('aws-sdk');
  var ActiveRecord = require('dynamodb-activerecord').ActiveRecord;

  // create the active record
  var ar = new ActiveRecord(
    {   tablename : "tablename",
        hashkey: "id",
        versionkey: "version",
        properties: {
            name : { type : "S" },
            status : { type : "N",  default: 1 }
        }
    }
  );

  ar.name = "testname";

  var dynamodb = new aws.DynamoDB({
      credentials  : new aws.Credentials(aws_accesskeyid, aws_secretaccesskey),
      region : aws_region,
      sslEnabled :  true,
      maxRetries :  3,
  });

  ar.save(dynamodb.client, function(err, response) {

  });
```

## ActiveRecord Constructor

The constructor takes two objects: preset data to populate the object with and a metadata object that represents the object's properties such as the hashkey, the rangekey, etc.

The metadata takes the following properties:

* __tablename:__ name of the table *[required]*
* __hashkey:__ name of the hashkey property *[required]*
* __rangekey:__ name of the rangekey property
* __versionkey:__ name of the versionkey property that enforces optimistic concurrency
* __properties:__ an object defining all properties for the table.

``` js
    var ar = new ActiveRecord(
      {   name: firstname" },
      {   tablename : "tablename",
          hashkey: "id",
          versionkey: "version",
          properties: {
              name : { type : "S" },
              status : { type : "N",  default: 1 }
          }
      }
    );
```

The active record created above will be populated with name = "firstname".  The id property will be the hashkey and the version property will be the versionkey.
An additional property named status is defined with a default of 1.  If the status property is undefined/null during a patch or a create (save), then it will be
populated with the value of 1.

Note that neither id or version are defined as properties.  Defining the hashkey, rangekey or versionkey is optional.  The hashkey will default to a string type with
an autogenerator of uuidv4.  The rangekey defaults to a string type and the versionkey defaults to a number with a default value of 1.

