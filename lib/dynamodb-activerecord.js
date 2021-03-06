(function () {
    "use strict";

    var assert          = require("assert");

    var sugar           = require("sugar");
    var murmurhash      = require("murmurhash");
    var uuid            = require("node-uuid");

    var metadatacache = {};

    function setmetadata(metadata)
    {
        // very very simply metadata cache.  We identify via an MD5 hash.  Yes, may have dupes, but do not care, just
        // doing this to keep memory consumption of multiple objects with same metadata down.
        var hash = murmurhash.v3(JSON.stringify(metadata));
        if(!metadatacache[hash])
            metadatacache[hash] = metadata;
        return hash;
    }

    /**
     * @constructor
     * @type {Function}
     */
    var ar = exports.ActiveRecord = function ActiveRecord(obj, metadata)
    {
        if(arguments.length === 1) {
            metadata = obj;
            obj = {};
        }

        assert(metadata, "metadata is required to be passed to the DynoActiveRecord constructor");
        assert(metadata.tablename, "metadata.tablename is required to be passed to the DynoActiveRecord constructor");
        assert(metadata.hashkey, "metadata.hashkey is required to be passed to the DynoActiveRecord constructor");

        metadata.properties = metadata.properties || {};

        // set default property for hashkey and rangekey (if passed) if it does not exist in the property array
        if(!metadata.properties.hasOwnProperty(metadata.hashkey))
            metadata.properties[metadata.hashkey] = {type : "S", generator: "uuidv4" };

        if(metadata.rangekey && !metadata.properties.hasOwnProperty(metadata.rangekey))
            metadata.properties[metadata.rangekey] = {type : "S" };

        // setup property default for version key if it has been set but does not exist as a property.
        if(metadata.versionkey && !metadata.properties.hasOwnProperty(metadata.versionkey))
            metadata.properties[metadata.versionkey] = {type : "N", default: 1 };

        // hang the metadata hash off the obj
        this._metadata = setmetadata(metadata);

        // populate the object
        for(var key in obj) {
            this[key] = obj[key];
        }
    }

    /**
     * Retrieves metadata for the current object.
     * @returns {Object}
     * @private
     */
    ar.prototype._getmetadata = function _getmetadata()
    {
        return metadatacache[this._metadata];
    }

    /**
     * Generates a value appropriate to be saved to DynamoDb.
     * @param property {Object}
     * @param value {*}
     * @returns {Object}
     * @private
     */
    ar.prototype._generateddbvalue = function _generateddbvalue(property, value)
    {
        if(value === null || value === undefined)
            return null;

        switch(property.type) {

            // UUID or string
            case "S": {
                if(Object.isString(value))
                    return { "S": value };
                else if(Object.isObject(value))
                    return { "S": JSON.stringify(value) };
                else
                    return { "S": value.toString() };
                break;
            }


            case "SS" : {
                return { "SS" : value.map(function(i){return i.toString();})};
                break;
            }


            case "OS" : {
                return { "SS" : value.map(function(i){return JSON.stringify(i);})};
                break;
            }


            case "N":{
                if(Object.isDate(value))
                    return { "N": value.getTime().toString() };
                else if (Object.isBoolean(value))
                    return { "N": value ? "1" : "0" };
                else
                    return { "N": value.toString() };
                break;
            }


            case "NS" : {
                var valresult =
                    value
                    .filter(function(v) { return ( v !== null && v !== undefined); })
                    .map( function(i){
                        if(Object.isDate(value))
                            return  i.getTime().toString() ;
                        else if (Object.isBoolean(i))
                            return  i ? "1" : "0" ;
                        else
                            return  i.toString() ;
                    });

                return { 'NS': valresult };
                break;
            }


            case "D":{
                if(Object.isDate(value))
                    return { "N" : value.getTime().toString() };
                else if(Object.isNumber(value))
                    return { "N" : value.toString() };
                else if(Object.isString(value))
                    return { "N" : new Date(value).getTime().toString() };
                break;
            }


            case "BU": {
                if(Buffer.isBuffer(value))
                    return { "B": value.toString('base64') };
                break;
            }


            case "BO": {
                if(Object.isNumber(value))
                    return { "N": value === 1 ? "1" : "0" };
                else if (Object.isBoolean(value))
                    return { "N": value ? "1" : "0" };
                else if (Object.isString(value))
                    return { "N": value.toLowerCase()==="true" ? "1" : "0" };
                else
                    return { "N": "0" };
                break;
            }


            case "O" : {
                return { "S" : !value ? {} : JSON.stringify(value)};
                break;
            }


        }

        return null;
    }

    ar.prototype._generatepropertyvaluefromddbvalue = function _generatepropertyvaluefromddbvalue(property, value) {

        assert(property, "property must be passed to _generatepropertyvaluefromddbvalue()");

        if(value === undefined || value === null)
            return null;

        value = value[property.type];

        switch(property.type) {
            // string or string array
            case 'SS':
            case 'S':
            default: {
                return value;
                break;
            }
            // number
            case 'N': {
                return parseFloat(value);
                break;
            }
            // buffer
            case 'B': {
                return new Buffer(value, 'base64');
                break;
            }
            // number array
            case 'NS': {
                return value.map(function(entry) { return parseFloat(entry); });
                break;
            }
            // buffer array
            case 'BS': {
                return value.map(function(entry) { return new Buffer(entry, 'base64'); });
                break;
            }
            // object
            case 'O': {
                return JSON.parse(value);
                break;
            }
            case "OS" : {
                return value.map(function(i){return JSON.parse(i);});
                break;
            }
            // boolean
            case "BO": {
                return value === 1 || value.toLowerCase() === "true";
                break;
            }

            case "D":
            {
                return new Date(parseFloat(value));
            }
        }

        return null;

    }

    ar.prototype._generatesaveddbrequestobject = function _generatesaveddbrequestobject(options)
    {
        var self = this, options = options || {};
        var metadata = this._getmetadata();
        var request = { TableName : metadata.tablename, Item : {} };

        var hashkeyval = this[metadata.hashkey];
        var tempobj = {};
        var newrec = options.isnewrec;

        // copy all the existing properties into the tempobj
        for(var key in metadata.properties) {

            tempobj[key] = this.hasOwnProperty(key) ? Object.clone(this[key], true) : null;

            // if this is a newrec and it does not have a value test for value substitution
            if(newrec && (tempobj[key] === null || tempobj[key] === undefined)) {

                // if value not defined at this point, check if it has a default value
                if(this[key] === null || this[key] === undefined && metadata.properties[key].hasOwnProperty("default"))
                    tempobj[key] = metadata.properties[key].default;

                // if STILL no new value, see if there is a generator setup for the property.
                if(this[key] === null || this[key] === undefined && metadata.properties[key].hasOwnProperty("generator")) {
                    if(Object.isFunction(metadata.properties[key].generator)) {
                        tempobj[key] = metadata.properties[key].generator.call(self);
                    }
                    else if(Object.isString(metadata.properties[key].generator)) {
                        var genid = metadata.properties[key].generator.toLowerCase();
                        if(genid == "uuidv1") {
                            tempobj[key] = uuid.v1();
                        }
                        else if(genid == "uuidv4") {
                            tempobj[key] = uuid.v4();
                        }
                        else if(genid == "now") {
                            tempobj[key] = new Date();
                        }
                    }
                }
            }
            // if this is the versionkey and this is not a newrec, there has to be a way to update the versionkey.
            else if(!newrec && key === metadata.versionkey) {
                if(metadata.properties[key].hasOwnProperty("generator")) {
                    if(Object.isFunction(metadata.properties[key].generator)) {
                        tempobj[key] = metadata.properties[key].generator.call(obj);
                    }
                    else if(Object.isString(metadata.properties[key].generator)) {
                        var genid = metadata.properties[key].generator.toLowerCase();
                        if(genid == "uuidv1") {
                            tempobj[key] = uuid.v1();
                        }
                        else if(genid == "uuidv4") {
                            tempobj[key] = uuid.v4();
                        }
                        else if(genid == "now") {
                            tempobj[key] = new Date();
                        }
                    }
                }
                if(metadata.properties[key].type === "N")
                    tempobj[key] = self[key] + 1;
                else if(metadata.properties[key].type === "D")
                    tempobj[key] = new Date();
            }
        }

        // populate item properties
        for(var key in tempobj)
        {
            var value = this._generateddbvalue(metadata.properties[key], tempobj[key]);

            if(value !== null)
                request.Item[key] = value;
        }

        // is there a version key - it needs to be passed as expected if version consistency is not dropped
        if(newrec) {
            var expected = {};
            expected[metadata.hashkey] = { "Exists" : false};
            request["Expected"] = expected;
        }
        else if(metadata.versionkey && !options.dropversionconsistency) {
            var expected = {};
            expected[metadata.versionkey] = {"Value" : this._generateddbvalue( metadata.properties[metadata.versionkey] , self[metadata.versionkey])};
            request["Expected"] = expected;
        }

        if(!newrec && options.getold)
            request["ReturnValues"] = "ALL_OLD";

        Object.merge(this, tempobj);

        return request ;
    }

    ar.prototype._generatedeleteddbrequestobject = function _generatedeleteddbrequestobject(options)
    {

        var self = this, options = options || {};
        var metadata = this._getmetadata();

        assert(this[metadata.hashkey], "the hashkey property must be set in order to delete a record");

        var request = { TableName : metadata.tablename, Key : { HashKeyElement : this._generateddbvalue( metadata.properties[metadata.hashkey] , this[metadata.hashkey])}};

        if(this[metadata.rangekey])
            request.Key.RangeKeyElement = this._generateddbvalue( metadata.properties[metadata.rangekey] , this[metadata.rangekey])

        // is there a version key - it needs to be passed as expected if version consistency is not dropped?
        if(metadata.versionkey && !options.dropversionconsistency) {
            var expected = {};
            expected[metadata.versionkey] = {"Value" : this._generateddbvalue( metadata.properties[metadata.versionkey] , this[metadata.versionkey])};
            request["Expected"] = expected;
        }

        if(options.getold)
            request["ReturnValues"] = "ALL_OLD";

        return request;
    }

    ar.prototype._generategetddbrequestobject = function _generategetddbrequestobject(keys, options)
    {

        var hashkeyvalue = keys.hashkeyvalue;
        var rangekeyvalue = keys.rangekeyvalue;
        options = options || {};

        var metadata = this._getmetadata();

        var request = {
            TableName: metadata.tablename,
            Key: {}
        };

        request.Key.HashKeyElement = this._generateddbvalue(metadata.properties[metadata.hashkey], hashkeyvalue);

        if(rangekeyvalue !== null && rangekeyvalue !== undefined && metadata.rangekey)
            request.Key.RangeKeyElement  = this._generateddbvalue(metadata.properties[metadata.rangekey], rangekeyvalue);


        if(options.hasOwnProperty("consistentread"))
            request.ConsistentRead = options.consistentread;

        if(options.hasOwnProperty("attributestoget"))
            request.AttributesToGet = options.attributestoget;

        return request;
    }

    /**
     * Creates a new record in DynamoDb.
     * @param client
     * @param options
     * @param callback
     */
    ar.prototype.create = function createrecord(client, options, callback)
    {
        assert(!this._isdeleted, "the object has been deleted and can not be saved again");
        assert(!this._invalidstate, "a previous action left the object in an invalid state - the operation can not be executed");

        var self = this;

        if(arguments.length === 2 && Object.isFunction(options)) {
            callback = options;
            options = {};
        }

        options = options || {};

        options.isnewrec = true;

        var request = this._generatesaveddbrequestobject(options);

        client.putItem(request, function(err, response) {

            if(err)
                this._invalidstate = true;

            return callback(err, !err ? response : null);
        });
    }

    ar.prototype.update = function updaterecord(client, options, callback)
    {
        assert(!this._isdeleted, "the object has been deleted and can not be saved again");
        assert(!this._invalidstate, "a previous action left the object in an invalid state - the operation can not be executed");

        var self = this;

        if(arguments.length === 2 && Object.isFunction(options)) {
            callback = options;
            options = {};
        }

        options = options || {};

        options.isnewrec = false;

        var request = this._generatesaveddbrequestobject(options);

        client.putItem(request, function(err, response) {
            if(err)
                this._invalidstate = true;
            return callback(err, !err ? response : null);
        });
    }

    /**
     * Deletes the record from DynamoDb.
     * @param client
     * @param options
     * @param callback
     */
    ar.prototype.delete = function deleterecord(client, options, callback)
    {
        assert(!this._isdeleted, "the object has already been deleted and can not be deleted again");
        assert(!this._invalidstate, "a previous action left the object in an invalid state - the operation can not be executed");

        var self = this;

        if(arguments.length === 2 && Object.isFunction(options)) {
            callback = options;
            options = {};
        }

        var request = this._generatedeleteddbrequestobject(options);

        client.deleteItem(request, function(err, response) {

            if(err) return callback(err);

            // walk through properties and delete
            for(var key in self._getmetadata().properties) {
                if(self.hasOwnProperty(key))
                    delete self[key];
            }

            self._isdeleted = true;

            return callback(null, response);
        });
    }

    ar.prototype.patch = function patchrecord(client)
    {

    }

    ar.prototype.load = function loadrecord(client, keys, options, callback)
    {
        if(arguments.length === 3 && Object.isFunction(options)) {
            callback = options;
            options = {};
        }

        var self = this;
        var metadata = self._getmetadata();

        // must have hashkey, rangekey is optional
        assert(keys.hashkeyvalue, "hashkeyvalue is required to be passed to getrecord(client, keys, options, callback)");
        assert(client, "client is required to be passed to getrecord(client, keys, options, callback)");
        assert(Object.isFunction(callback), "callback is required to be a function when passed to getrecord(client, keys, options, callback)");

        var requestobj = this._generategetddbrequestobject(keys, options);

        client.getItem(requestobj, function(err, response) {

            if(err) return callback(err);
            // loop through the returned attributes to properly populate the item.
            for(var key in response.Item) {

                var value = response.Item[key];

                // if it exists as a metadata property, then translate it based on the metadata.  If it does not have a matching property
                // and options.allowloose is truthy, then translate it directly as a DynamoDb value.
                if(metadata.properties.hasOwnProperty(key))
                {

                    self[key] = self._generatepropertyvaluefromddbvalue(metadata.properties[key], value);
                }
                else if(options.allowloose) {
                    self[key] = value[Object.keys(value)[0]];
                }
            }

            return callback(err, response);

        });
    }



}());
