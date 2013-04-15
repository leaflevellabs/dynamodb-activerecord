##dynamodb-activerecord

This is an active record implementation for Amazon's DynamoDb.

### Installation via npm

``` sh
  $ npm install dynamodb-activerecord
```
### Sample Usage (upsert one record)

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

### ActiveRecord Constructor

The constructor takes two objects: preset data to populate the object with and a metadata object that represents the object's properties such as the hashkey, the rangekey, etc.

The metadata takes the following properties:

* __tablename:__ name of the DynamoDb table *[required]*
* __hashkey:__ name of the hashkey property *[required]*
* __rangekey:__ name of the rangekey property
* __versionkey:__ name of the versionkey property that enforces optimistic concurrency
* __properties:__ an object defining all properties for the table.

Each property can be defined with the following properties:
* __type:__ datatype of the property *[required]*
* __default:__ value to assign the property on initial create and patch actions if the value is either undefined or null
* __generator:__ either a function or a string representing a predefined generator name.  The generator will create a
value for the property during an initial upsert if the property value is either undefined or null and no default value is assigned.
If the versionkey is a generator, it will also generate a new value for all updates or patches as well.  The predefined generator types
are: uuidv1 (UUID type 1), uuidv4 (UUID type 4) and now (current Date()).

Here is a sample new ActiveRecord():

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

The active record will be populated with *[name]* = "firstname".  The *[id]* property will be the hashkey and the *[version]* property will be the versionkey.
An additional property named status is defined with a default of 1.  If the *[status]* property is undefined/null during a patch or a create (save), then it will be
populated with the value of 1.

Note that neither *[id]* or *[version]* are defined as properties in the example.  Defining the hashkey, rangekey or versionkey is optional.  The hashkey will default to a string type with
an autogenerator of uuidv4.  The rangekey defaults to a string type and the versionkey defaults to a number with a default value of 1.

### Public Methods

#### save(client, options, callback)

Either inserts a new record or updates an existing record (upsert), depending on the hashkey context.  If a hashkey property is either NULL or UNDEFINED on the ActiveRecord object, the save will create a new record.  Otherwise,
the save will replace the existing record.

* __client:__ AWS client *[required]*
* __options:__ upsert options
* __callback:__

The options object can contain the following properties:
* __newhashkeyvalue:__ overrides any values already set for the hashkey.  Prevents defaults and generators from firing.  Only relevant during inserts.  Ignored during updates.
* __newrangekeyvalue:__ overrides any values already set for the rangekey.  Prevents defaults and generators from firing.  Only relevant during inserts.  Ignored during updates.
* __newversionkeyvalue:__ overrides any values already set for the version.  Prevents defaults and generators from firing for the versionkey.  This value can be set during inserts or updates.
* getold:__ during an update, will return old values of the record before the update.  Irrelevant for inserts.

#### delete(client, options, callback)
#### get(client, hashkeyvalue, rangekeyvalue, options, callback)

