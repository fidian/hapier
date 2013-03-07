var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/jsonschema.js",function(require,module,exports,__dirname,__filename,process,global){/**
 * JSON Schema object
 *
 * Create a schema object that can check validation, complete itself, etc.
 *
 * TODO:  Set 'id'
 * TODO:  Possibly handle $schema
 */
'use strict';

var SimpleNotify, Uri, util;

SimpleNotify = require('./simplenotify');
Uri = require('./uri');
util = require('./util');

/**
 * Create a new JSONSchema object
 *
 * @param string schemaUri Schema's ID as per how it was fetched (full URI)
 * @param Object schema Schema related information
 */
function JSONSchema(schemaId, schema) {
	// Allow people to omit the 'new' keyword
	if (!(this instanceof JSONSchema)) {
		return new JSONSchema(schemaId, schema);
	}

	this.schemaId = schemaId;
	this.schemaRaw = util.clone(schema);
	this.schema = schema;
}


/**
 * Call a resolver method given its name.
 * Forces the scope appropriately
 *
 * @param string name
 * @param object obj
 * @param string propName
 * @param Function fetcher (uri, callback)
 * @param SimpleNotify notifier
 * @return mixed Whatever came from the resolver method
 */
JSONSchema.prototype.callResolverMethod = function callResolverMethod(name, obj, propName, fetcher, notifier) {
	var method;

	method = this.resolverMethods[name];
	return method.call(this, obj, propName, fetcher, notifier);
};

/**
 * Compare if two values are the same.  This embodies the logic that is
 * used for uniqueItems comparisons.
 *
 * @param mixed a
 * @param mixed b
 * @return boolean True if they are the same
 */
JSONSchema.prototype.compare = function compare(a, b) {
	var aKeys, aType, bKeys, bType, myself, valid;

	aType = this.determineType(a);
	bType = this.determineType(b);
	myself = this;

	if (aType !== bType) {
		return false;
	}

	switch (aType) {
	case 'null':
		// If they are both null, they can't differ
		return true;

	case 'boolean':
	case 'integer':
	case 'number':
	case 'string':
		// Compare the value
		if (a === b) {
			return true;
		}

		return false;

	case 'array':
		if (a.length !== b.length) {
			return false;
		}

		valid = a.every(function (aValue, aKey) {
			if (!myself.compare(aValue, b[aKey])) {
				return false;
			}

			return true;
		});
		return valid;

	case 'object':
		aKeys = Object.keys(a);
		bKeys = Object.keys(b);

		if (!this.compare(aKeys, bKeys)) {
			return false;
		}

		valid = aKeys.every(function (key) {
			if (!myself.compare(a[key], b[key])) {
				return false;
			}

			return true;
		});
		return valid;
	}

	// "unknown" and "undefined" should not be passed in.
	// Treat them as being different
	return false;
};

/**
 * Gets the effective type of the data, not the type from the schema.
 *
 * @param mixed data
 * @return string type
 */
JSONSchema.prototype.determineType = function determineType(data) {
	switch (typeof data) {
	case 'boolean':
		return 'boolean';

	case 'number':
		if (Math.round(data) === data) {
			return 'integer';
		}

		return 'number';

	case 'null':
		return 'null';

	case 'object':
		if (Array.isArray(data)) {
			return 'array';
		}

		return 'object';

	case 'string':
		return 'string';

	case 'undefined':
		return 'undefined';
	}

	return 'unknown';
};


/**
 * Assign getters that also search the schemas which extend this one.
 */
util.iterate({
	/*
	additionalItems: 'booleanOrSchema',
	additionalProperties: 'booleanOrSchema',
	dependencies: 'typeOrSchema',
	divisibleBy: 'numberNotZeroOrNull',
	'extends': 'schemaOrArrayOfSchemas',
	items: 'schemaOrArrayOfSchemas',
	*/
	'default': 'firstValue',
	description: 'firstValue',
	'enum': 'uniqueArray',
	exclusiveMaximum: 'trueIfOneIsTrue',
	exclusiveMinimum: 'trueIfOneIsTrue',
	format: 'firstValue',
	maximum: 'minimum',
	maxItems: 'minimum',
	maxLength: 'minimum',
	minimum: 'maximum',
	minItems: 'maximum',
	minLength: 'maximum',
	pattern: 'firstValue',
	patternProperties: 'propertyCollection',
	properties: 'propertyCollection',
	required: 'trueIfOneIsTrue',
	title: 'firstValue',
	type: 'type',
	uniqueItems: 'trueIfOneIsTrue'
}, function (type, property) {
	var fn, myself;

	fn = function () {};

	function extendData(schema, callback) {
		if (schema.schema[property] !== undefined) {
			callback(schema.schema[property]);
		}
		if (schema.schema['extends']) {
			if (Array.isArray(schema.schema['extends'])) {
				schema.schema['extends'].forEach(function (childSchema) {
					extendData(childSchema, callback);
				});
			} else {
				extendData(schema.schema['extends'], callback);
			}
		}
	}

	switch (type) {
	case 'firstValue':
		fn = function firstValue() {
			var val = null;
			extendData(this, function (testVal) {
				if (!val && testVal) {
					val = testVal;
				}
			});
			return val;
		};
		break;

	case 'maximum':
		fn = function maximum() {
			var result = null;
			extendData(this, function (val) {
				if (result === null || val > result) {
					result = val;
				}
			});
			return result;
		};
		break;

	case 'minimum':
		fn = function minimum() {
			var result = null;
			extendData(this, function (val) {
				if (result === null || val < result) {
					result = val;
				}
			});
			return result;
		};
		break;

	case 'propertyCollection':
		fn = function propertyCollection() {
			var properties = {};
			extendData(this, function (newProperties) {
				util.iterate(newProperties, function (propValue, propName) {
					properties[propName] = propValue;
				});
			});

			return properties;
		};
		break;

	case 'trueIfOneIsTrue':
		fn = function trueIfOneIsTrue() {
			var result = false;
			extendData(this, function (val) {
				if (val) {
					result = true;
				}
			});
			return result;
		};
		break;

	case 'type':
		fn = function type() {
			var result = [];
			extendData(this, function (val) {
				if (Array.isArray(val)) {
					JSONSchema.prototype.uniqueArrayAdd(result, val);
				} else if (val) {
					JSONSchema.prototype.uniqueArrayAdd(result, [ val ]);
				}
			});

			if (result.length === 0) {
				return null;
			}

			return result;
		};
		break;

	case 'uniqueArray':
		fn = function uniqueArray() {
			var result = null;
			extendData(this, function (val) {
				if (Array.isArray(val)) {
					if (!Array.isArray(result)) {
						result = [];
					}

					JSONSchema.prototype.uniqueArrayAdd(result, val);
				}
			});
			return result;
		};
		break;
	}

	JSONSchema.prototype['get' + property.charAt(0).toUpperCase() + property.slice(1)] = fn;
});


/**
 * Determine if a type passed in (string only) is a simple type.
 *
 * @param string type
 * @return boolean True if this is a simple type
 */
JSONSchema.prototype.isSimpleType = function isSimpleType(type) {
	if (type === undefined) {
		type = this.schema.type;
	}

	if (typeof type === 'object') {
		type = type.toString();
	}

	if (typeof type !== 'string') {
		return false;
	}

	switch (type) {
	case 'any':
	case 'array':
	case 'boolean':
	case 'integer':
	case 'null':
	case 'number':
	case 'object':
	case 'string':
		return true;
	}

	return false;
};


/**
 * Resolve an object, fetching additional resources as necessary.
 * The actual fetching is done by resolveSchema()
 *
 * @param Function fetcher (uri, callback)
 * @param Function whenDone (err)
 */
JSONSchema.prototype.resolve = function resolve(fetcher, whenDone) {
	var myself, uri;

	myself = this;

	function resolve_theRest() {
		var map, notifier, property;

		notifier = new SimpleNotify(function (err) {
			if (err) {
				whenDone(err);
			} else {
				whenDone(null, myself);
			}
		});

		util.iterate(JSONSchema.prototype.resolverMapping, function (func, propName) {
			myself.callResolverMethod(func, myself.schema, propName, fetcher, notifier);
		});
	}

	// Handle $ref first and it must complete before we tackle any other
	// properties
	if (this.schema.$ref) {
		// URI resolution
		uri = new Uri(this.schema.$ref, this.schemaId);

		// Get the schema - this returns the correct JSON Schema object
		// by following the URL and the pointer
		fetcher(uri.toString(), function resolve_ref(err, data) {
			console.log(uri.toString(), err, data);
			if (err) {
				whenDone(err);
				return;
			}

			myself.schema = data;
			myself.$ref = uri.toString();
			resolve_theRest();
		});
	} else {
		resolve_theRest();
	}
};


/**
 * Map a schema's properties to a method that helps ensure it is valid or
 * that will set it to a default value.
 */
JSONSchema.prototype.resolverMapping = {
	additionalItems: 'booleanOrSchema',
	additionalProperties: 'booleanOrSchema',
	'default': 'any',
	dependencies: 'dependencies',
	description: 'stringOrNull',
	divisibleBy: 'numberNotZeroOrNull',
	'enum': 'arrayOrNull',
	exclusiveMaximum: 'booleanDefaultFalse',
	exclusiveMinimum: 'booleanDefaultFalse',
	'extends': 'schemaOrArrayOfSchemas',
	format: 'stringOrNull',
	items: 'schemaOrArrayOfSchemas',
	maximum: 'numberOrNull',
	maxItems: 'integerOrNull',
	maxLength: 'integerOrNull',
	minimum: 'numberOrNull',
	minItems: 'integerOrNull',
	minLength: 'integerOrNull',
	pattern: 'stringOrNull',
	patternProperties: 'objectOfSchemas',
	properties: 'objectOfSchemas',
	required: 'booleanDefaultFalse',
	title: 'stringOrNull',
	type: 'type',
	uniqueItems: 'booleanDefaultFalse'
};


/**
 * Individual functions that handle the different variations of properties
 */
JSONSchema.prototype.resolverMethods = {
	/**
	 * Allow anything
	 */
	any: function (obj, property, fetcher, notifier) {
	},

	/**
	 * This value must be an array or set this to null
	 */
	arrayOrNull: function (obj, property, fetcher, notifier) {
		if (!Array.isArray(obj[property])) {
			obj[property] = null;
			return;
		}
	},

	/**
	 * The property should be a boolean.  If not specified, the value is
	 * considered false.
	 */
	booleanDefaultFalse: function (obj, property, fetcher, notifier) {
		if (obj[property] === undefined) {
			obj[property] = false;
			return;
		}

		obj[property] = !!obj[property];
	},

	/**
	 * The value should be a boolean or a schema object.  Set the default value
	 * of 'true' since booleanDefaultFalse will make the default not friendly
	 * to JSON Schema spec.
	 */
	booleanOrSchema: function (obj, property, fetcher, notifier) {
		if (obj[property] === undefined) {
			obj[property] = true;
			return;
		}

		if (typeof obj[property] === 'object') {
			this.callResolverMethod('schema', obj, property, fetcher, notifier);
			return;
		}

		this.callResolverMethod('booleanDefaultFalse', obj, property, fetcher, notifier);
	},

	/**
	 * An object that contains schemas or types as values
	 */
	dependencies: function (obj, property, fetcher, notifier) {
		var myself;

		myself = this;

		if (typeof obj[property] !== 'object') {
			obj[property] = {};
			return;
		}

		util.iterate(obj[property], function (value, key) {
			myself.callResolverMethod('typeOrSchema', obj[key], key, fetcher, notifier);
		});
	},

	/**
	 * Make this an integer or set it to a null value
	 */
	integerOrNull: function (obj, property, fetcher, notifier) {
		if (typeof obj[property] !== 'number') {
			obj[property] = null;
			return;
		}

		obj[property] = Math.round(obj[property]);
	},

	/**
	 * Make this an integer that is not zero or set it to a null value
	 */
	numberNotZeroOrNull: function (obj, property, fetcher, notifier) {
		if (typeof obj[property] !== 'number') {
			obj[property] = null;
			return;
		}

		if (obj[property] === 0) {
			obj[property] = null;
			return;
		}
	},

	/**
	 * Make this a number or set it to a null value
	 */
	numberOrNull: function (obj, property, fetcher, notifier) {
		if (typeof obj[property] !== 'number') {
			obj[property] = null;
			return;
		}
	},

	/**
	 * An object that contains schemas as properties
	 */
	objectOfSchemas: function (obj, property, fetcher, notifier) {
		var myself;

		myself = this;

		if (typeof obj[property] !== 'object') {
			obj[property] = {};
			return;
		}

		util.iterate(obj[property], function (propValue, propName) {
			myself.callResolverMethod('schema', obj[property], propName, fetcher, notifier);
		});
	},

	/**
	 * Only allow a schema here.  If an invalid value is found, convert to
	 * an empty schema.
	 */
	schema: function (obj, property, fetcher, notifier) {
		if (typeof obj[property] !== 'object') {
			obj[property] = {};
			// Do not return here - process the empty schema to set up rules
		}

		this.resolveSchema(obj, property, fetcher, notifier.done());
	},

	/**
	 * A schema or an array of schemas
	 */
	schemaOrArrayOfSchemas: function (obj, property, fetcher, notifier) {
		var myself;

		myself = this;

		if (Array.isArray(obj[property])) {
			obj[property].forEach(function (propName) {
				myself.callResolverMethod('schema', obj[property], propName, fetcher, notifier);
			});
			return;
		}

		if (!obj[property]) {
			return;
		}

		this.callResolverMethod('schema', obj, property, fetcher, notifier);
	},

	/**
	 * Make this a string or set it to a null value
	 */
	stringOrNull: function (obj, property, fetcher, notifier) {
		if (typeof obj[property] !== 'string') {
			obj[property] = null;
		}
	},

	/**
	 * These are a known type (string) or a schema or possibly a list of
	 * known types (strings) or schemas in an array.
	 *
	 * Convert everything to an array for easier comparisons.  Also, make
	 * the items in the array unique.
	 */
	type: function (obj, property, fetcher, notifier) {
		var myself, unique;

		myself = this;

		if (!Array.isArray(obj[property])) {
			obj[property] = [ obj[property] ];
		}

		if (!obj[property].length) {
			obj[property] = [ 'any' ];
			return;
		}

		unique = [];
		JSONSchema.prototype.uniqueArrayAdd(unique, obj[property]);
		obj[property] = unique;
		obj[property].forEach(function (value, key) {
			myself.callResolverMethod('typeOrSchema', obj[key], key, fetcher, notifier);
		});
	},

	/**
	 * This should be either a single simple type or schema.  If not known,
	 * this defaults to 'any'
	 */
	typeOrSchema: function (obj, property, fetcher, notifier) {
		if (obj === undefined) {
			return;
		}

		if (this.isSimpleType(obj[property])) {
			return;
		}

		if (typeof obj[property] === 'object') {
			// Objects should be schemas
			this.callResolverMethod('schema', obj, property, fetcher, notifier);
			return;
		}

		// Treat the rest as "any"
		obj[property] = "any";
	}
};


/**
 * Go lookup a schema using the provided fetching function.  This can be
 * either async or sync, depending on if we need to actually fetch a
 * schema or if one was already fetched earlier.
 *
 * @param Object parentObj
 * @param number|string key
 * @param Function fetcher (uri, callback)
 * @param Function whenDone (err)
 */
JSONSchema.prototype.resolveSchema = function resolveSchema(parentObj, key, fetcher, whenDone) {
	var schema = new JSONSchema(this.schemaId, parentObj[key]);
	parentObj[key] = schema;
	schema.resolve(fetcher, whenDone);
};


/**
 * Uniquely add more things to a target array
 *
 * @param Array target Array that should grow
 * @param Array more Array containing elements that may be added to target
 */
JSONSchema.prototype.uniqueArrayAdd = function uniqueArrayAdd(target, more) {
	more.forEach(function (moreVal) {
		if (moreVal !== undefined && !target.some(function (targetVal) {
				if (JSONSchema.prototype.compare(moreVal, targetVal)) {
					return true;
				}

				return false;
			})) {
			target.push(moreVal);
		}
	});
};


/**
 * Validate that data matches this schema
 *
 * @param function failureCallback (path, code, message)
 * @param string path Current path to this object
 * @return boolean
 */
JSONSchema.prototype.validate = function validate(data, failureCallback, path) {
	var dataType, errors, method, myself, result;

	if (typeof failureCallback !== 'function') {
		failureCallback = function () {};
	}

	if (typeof path !== 'string') {
		path = '';
	}

	if (data === undefined && this.schema['default'] !== undefined) {
		data = this.schema['default'];
	}

	path += '/';
	dataType = this.determineType(data);
	myself = this;
	errors = 0;

	util.iterate(this.validateMethods, function (func, propName) {
		var result;

		function validateFailureCallback(message) {
			failureCallback(path, propName, message);
		}

		result = func.call(myself, myself.schema[propName], data, dataType, validateFailureCallback);

		if (!result) {
			// TODO:  Maybe stop immediately
			errors += 1;
		}
	});

	return errors === 0;
};


/**
 * Validation methods for every rule
 */
JSONSchema.prototype.validateMethods = {
	/**
	 * Must match one of the simple types or validate against a schema.
	 * This also allows undefined to pass and the 'required' attribute
	 * should be the one enforcing if a value is present.
	 */
	type: function (rule, data, dataType, failureCallback) {
		var result;

		if (dataType === 'undefined') {
			return true;
		}

		result = rule.some(function (testType) {
			// Handle schema objects
			if (typeof testType === 'object') {
				return testType.validate(data);
			}

			// Handle basic types and "any"
			if (testType === "any" || testType === dataType) {
				return true;
			}

			return false;
		});

		if (!result) {
			failureCallback();
		}

		return result;
	},

	/**
	 * The properties listed must match against the matching schema
	 */
	properties: function (rule, data, dataType, failureCallback) {
		var valid;

		if (dataType !== 'object') {
			return true;
		}

		valid = true;

		util.iterate(rule, function (subSchema, propName) {
			if (!subSchema.validate(data[propName])) {
				// TODO:  Chain the failure callback into the call to validate()
				failureCallback(propName);
				valid = false;
			}
		});

		return valid;
	},

	/**
	 * Match a schema against multiple properties whose name matches a
	 * pattern.
	 */
	patternProperties: function (rule, data, dataType, failureCallback) {
		var myself, valid;

		if (dataType !== 'object') {
			return true;
		}

		myself = this;
		valid = true;

		util.iterate(rule, function (subSchema, propPatternString) {
			var propPattern;

			propPattern = new RegExp(propPatternString);
			util.iterate(data, function (dataValue, dataProperty) {
				if (dataProperty.match(propPattern)) {
					if (!subSchema.validate(dataValue)) {
						failureCallback(dataProperty);
						valid = false;
					}
				}
			});
		});

		return valid;
	},

	additionalProperties: function (rule, data, dataType, failureCallback) {
		var myself, propNames, valid;

		if (dataType !== 'object') {
			return true;
		}

		myself = this;
		propNames = Object.keys(data);

		// Remove property names matching a property in this.schema.properties
		propNames = propNames.filter(function (propName) {
			if (myself.schema[propName] !== undefined) {
				return false;  // Remove
			}

			return true;  // Keep
		});

		// Remove property names matching a patternProperties pattern
		util.iterate(this.schema.patternProperties, function (subSchema, patternString) {
			var pattern;

			pattern = new RegExp(patternString);
			propNames = propNames.filter(function (propName) {
				if (propName.match(pattern)) {
					return false;  // Remove
				}

				return true;  // Keep
			});
		});

		if (propNames.length === 0) {
			return true;
		}

		if (rule === false) {
			// No additional properties were allowed to exist
			failureCallback();
			return false;
		}

		valid = true;

		if (rule !== true) {
			// All properties left over must validate against a schema
			propNames.forEach(function (propName) {
				if (!rule.validate(data[propName])) {
					failureCallback(propName);
					valid = false;
				}
			});
		}

		return valid;
	},

	items: function (rule, data, dataType, failureCallback) {
		var valid;

		if (dataType !== 'array') {
			return true;
		}

		valid = true;

		if (!Array.isArray(rule)) {
			// All items in the array must match the schema
			data.forEach(function (item, offset) {
				if (!rule.validate(item)) {
					failureCallback(offset);
					valid = false;
				}
			});
			return valid;
		}

		// Tuple typing - a positional validation
		rule.forEach(function (subSchema, offset) {
			if (!subSchema.validate(data[offset])) {
				failureCallback(offset);
				valid = false;
			}
		});

		return valid;
	},

	additionalItems: function (rule, data, dataType, failureCallback) {
		var myself, valid;

		if (dataType !== 'array' || !Array.isArray(this.schema.items)) {
			return true;
		}

		myself = this;
		valid = true;
		data.forEach(function (value, key) {
			// Ignore data validated by 'items' rule
			if (key >= myself.schema.items.length) {
				if (!rule.validate(value)) {
					failureCallback(key);
					valid = false;
				}
			}
		});
		return valid;
	},

	required: function (rule, data, dataType, failureCallback) {
		if (rule && dataType === 'undefined') {
			failureCallback();
			return false;
		}

		return true;
	},

	dependencies: function (rule, data, dataType, failureCallback) {
		var myself, valid;

		if (dataType !== 'object') {
			return true;
		}

		myself = this;
		valid = true;

		util.iterate(rule, function (propValue, propName) {
			// Determine if we can skip this dependency
			if (data[propName] === undefined) {
				return;
			}

			// Simple dependency - if A is specified, B must exist
			if (typeof propValue === 'string') {
				if (data[propValue] === undefined) {
					failureCallback(propName);
					valid = false;
				}

				return;
			}

			// Schema dependency - if A is specified, the data must
			// validate against this additional schema
			if (!propValue.validate(data)) {
				failureCallback(propName);
				valid = false;
			}
		});

		return valid;
	},

	minimum: function (rule, data, dataType, failureCallback) {
		if (dataType !== 'number' && dataType !== 'integer') {
			return true;
		}

		if (rule === null) {
			return true;
		}

		if (this.schema.exclusiveMinimum) {
			if (data <= rule) {
				failureCallback();
				return false;
			}
		} else {
			if (data < rule) {
				failureCallback();
				return false;
			}
		}

		return true;
	},

	maximum: function (rule, data, dataType, failureCallback) {
		if (dataType !== 'number' && dataType !== 'integer') {
			return true;
		}

		if (rule === null) {
			return true;
		}

		if (this.schema.exclusiveMaximum) {
			if (data >= rule) {
				failureCallback();
				return false;
			}
		} else {
			if (data > rule) {
				failureCallback();
				return false;
			}
		}

		return true;
	},

	minItems: function (rule, data, dataType, failureCallback) {
		if (dataType !== 'array' || rule === null) {
			return true;
		}

		if (data.length < rule) {
			failureCallback();
			return false;
		}

		return true;
	},

	maxItems: function (rule, data, dataType, failureCallback) {
		if (dataType !== 'array' || rule === null) {
			return true;
		}

		if (data.length > rule) {
			failureCallback();
			return false;
		}

		return true;
	},

	uniqueItems: function (rule, data, dataType, failureCallback) {
		var myself, unique, valid;

		if (dataType !== 'array') {
			return true;
		}

		myself = this;
		unique = [];
		valid = true;

		valid = data.every(function (item, offset) {
			if (!unique.some(function (uniqueItem) {
					return myself.compare(item, uniqueItem);
				})) {
				unique.push(item);
				return true;
			}

			failureCallback(offset);
			return false;
		});

		return valid;
	},

	pattern: function (rule, data, dataType, failureCallback) {
		var pattern;

		if (dataType !== 'string' || rule === null) {
			return true;
		}

		pattern = new RegExp(rule);

		if (!data.match(pattern)) {
			failureCallback();
			return false;
		}

		return true;
	},

	minLength: function (rule, data, dataType, failureCallback) {
		if (dataType !== 'string' || rule === null) {
			return true;
		}

		if (data.length < rule) {
			failureCallback();
			return false;
		}

		return true;
	},

	maxLength: function (rule, data, dataType, failureCallback) {
		if (dataType !== 'string' || rule === null) {
			return true;
		}

		if (data.length > rule) {
			failureCallback();
			return false;
		}

		return true;
	},

	'enum': function (rule, data, dataType, failureCallback) {
		var myself;

		if (dataType === 'undefined') {
			// This is handled by 'required'
			return true;
		}

		if (rule === null) {
			// No rule to validate against
			return true;
		}

		myself = this;

		if (rule.some(function (enumValue) {
				if (myself.compare(enumValue, data)) {
					return true;
				}

				return false;
			})) {
			return true;
		}

		failureCallback();
		return false;
	},

	'divisibleBy': function (rule, data, dataType, failureCallback) {
		if (dataType !== 'integer' && dataType !== 'number') {
			return true;
		}

		if (rule === null) {
			return true;
		}

		if (data / rule === 0) {
			return true;
		}

		failureCallback();
		return false;
	},

	/**
	 * Same idea as 'type', but the logic is reversed.  If any schema
	 * or simple type matches, then this is invalid.
	 */
	disallow: function (rule, data, dataType, failureCallback) {
		if (dataType === 'undefined') {
			return true;
		}

		if (!rule) {
			// No rule, so no need to worry
			return true;
		}

		return rule.every(function (testType, offset) {
			var result;

			// Handle schema objects
			if (typeof testType === 'object') {
				result = testType.validate(data);

				if (result) {
					// Successful validation means this matched - force failure
					failureCallback(offset);
					return false;
				}

				return true;
			}

			// Handle basic types and "any"
			if (testType === "any" || testType === dataType) {
				// We shouldn't match "any"
				failureCallback(offset);
				return false;
			}

			return true;
		});
	},

	'extends': function (rule, data, dataType, failureCallback) {
		if (!rule) {
			// No schema, so don't validate
			return true;
		}

		if (!Array.isArray(rule)) {
			if (!rule.validate(data)) {
				// TODO:  Chain the failure callback into the call to validate()
				failureCallback();
				return false;
			}

			return true;
		}

		if (!rule.every(function (subSchema) {
				return subSchema.validate(data);
			})) {
			// TODO:  Chain the failure callback into the call to validate()
			failureCallback();
			return false;
		}

		return true;
	}
};

module.exports = JSONSchema;

});

require.define("/simplenotify.js",function(require,module,exports,__dirname,__filename,process,global){/**
 * Very simplistic async signalling when a process is done.
 *
 * Assuming you have an arbitrary number of jobs that you want to
 * execute and that some of them may or may not be asynchronous.  This
 * lets you get all of the stack processing out of the way easily and your
 * final callback will happen on the first error, killing the stack, or
 * when everything is done.
 *
 * Limitations:
 *  - This checks for waiting jobs immediately after your program lets go
 *    (it is set up with setTimeout), so synchronously queue your jobs up.
 *  - The callback is called on the first exception reported (node style)
 *    or when all work is completed.
 */
'use strict';


/**
 * Constructor
 *
 * @param Function callback Final callback, only called once on error / success
 */
function SimpleNotify(callback) {
	var myself = this;

	if (!(this instanceof SimpleNotify)) {
		return new SimpleNotify(callback);
	}

	this.callback = callback;
	this.ready = false;  // Will automatically set to true after all sync jobs
	this.isDone = false;  // When done, no more callbacks should be called
	this.err = null;
	this.waitingFor = 0;

	// Automatically flag that this job can return values on the next tick
	setTimeout(function () {
		myself.ready = true;

		if (myself.err) {
			myself.isDone = true;
			myself.callback(myself.err);
		} else if (myself.waitingFor === 0) {
			myself.isDone = true;
			myself.callback(null);
		}
	}, 1);
}


/**
 * Returns a function that will tell the stack that a job has completed.
 *
 * @return Function
 */
SimpleNotify.prototype.done = function done() {
	var myself = this;

	if (this.state === 2) {
		throw new Error('Do not add jobs when the stack is completed');
	}

	this.waitingFor += 1;
	return function doneFunction(err) {
		myself.waitingFor -= 1;

		// Ignore everything if we're flagged as done
		if (myself.isDone) {
			return;
		}

		if (!myself.ready) {
			// Not ready to handle callbacks yet - still in sync portion
			if (err) {
				// The error is handled automatically in async portion
				myself.isDone = true;
				myself.err = err;
			}
		} else {
			// Do the final callback here if there's nothing left or on error
			if (err) {
				myself.isDone = true;
				myself.callback(err);
			} else if (myself.waitingFor === 0) {
				myself.isDone = true;
				myself.callback(null);
			}
		}
	};
};


module.exports = SimpleNotify;

});

require.define("/uri.js",function(require,module,exports,__dirname,__filename,process,global){'use strict';

var loadCache, fetchCache, proto, util;

util = require('./util');


function URI(uri, base) {
	if (!(this instanceof URI)) {
		return new URI(uri, base);
	}

	if (uri instanceof URI) {
		if (base !== undefined) {
			return new URI(uri.toString(), base);
		}

		return uri;
	}

	this.parseUri(uri);

	if (base !== undefined) {
		base = new URI(base);
		this.resolveAgainst(base);
	}
}


/**
 * Parses out just the authority information and the host from a URI
 *
 * @param string uri URI starting with a potential authority/host section
 * @return string Remainder of URI
 */
URI.prototype.parseAuthorityHost = function parseAuthorityHost(uri) {
	var hostport, lastIndex;

	this.userInfo = '';
	this.host = '';
	this.port = '';
	uri = uri.split('@');

	if (uri.length > 1) {
		if (uri[0].indexOf('/') >= 0) {
			uri = uri.join('@');
		} else {
			this.userInfo = uri[0];
			uri = uri[1];
		}
	} else {
		uri = uri[0];
	}

	uri = uri.split('/');

	if (uri.length > 0 && uri[0].length) {
		hostport = uri[0];
		uri[0] = '';
		hostport = hostport.split(':');
		lastIndex = hostport.length - 1;

		if (lastIndex > 0 && hostport[lastIndex].match(/^[0-9]*$/)) {
			this.port = hostport[lastIndex];
			hostport.pop();
		}

		this.host = hostport.join(':');
	}

	uri = uri.join('/');
	return uri;
};


/**
 * Parse a URI string into this object
 *
 * @param string uri
 */
URI.prototype.parseUri = function parseUri(uri) {
	this.scheme = '';
	this.path = [];
	this.query = null;
	this.fragment = null;

	uri = uri.trim();
	uri = uri.split('#');

	if (uri.length > 1) {
		this.fragment = uri[1];
	}

	uri = uri[0];
	uri = uri.split('?');

	if (uri.length > 1) {
		this.query = uri[1];
	}

	uri = uri[0];

	if (uri.substr(0, 2) === '//') {
		// Relative schema
		uri = uri.substr(2);
		uri = this.parseAuthorityHost(uri);
	} else {
		uri = uri.split('://');

		if (uri.length > 1 && uri[0].match(/^[a-z][\-+a-z0-9]*$/i)) {
			this.scheme = uri[0];
			uri = this.parseAuthorityHost(uri[1]);
		} else {
			uri = uri.join('://');
		}
	}

	if (uri.length > 0) {
		this.path = uri.split('/');
	}
};


/**
 * Resolve the current URI against another
 *
 * @param URI base
 */
URI.prototype.resolveAgainst = function resolveAgainst(base) {
	var dirs, dirsResolved;

	if (this.scheme === '') {
		this.scheme = base.scheme;
	}

	// Quickly detect absolute URLs - they all need a host
	if (this.host) {
		return;
	}

	// If we have no host, we don't have any of these
	this.userInfo = base.userInfo;
	this.host = base.host;
	this.port = base.port;

	// Keep our path if it starts with /
	if (this.path.length && this.path[0] !== '') {
		// Resolve the new path
		dirs = util.clone(base.path);

		if (dirs[0] === '') {
			// Remove the empty first bit indicating base is an absolute path
			dirs.shift();
		}

		// Remove the last thing from the previous path (filename or empty)
		dirs.pop();

		// Now add our new path
		this.path.forEach(function (item) {
			dirs.push(item);
		});
		dirsResolved = [];
		dirs.forEach(function (dir) {
			if (dir === '..') {
				dirsResolved.pop();
			} else if (dir !== '.') {
				dirsResolved.push(dir);
			}
		});

		// Add the empty portion indicating this is an absolute path
		dirsResolved.unshift('');
		this.path = dirsResolved;
	}

	// If the dirs didn't change, then we could maybe keep the query
	if (this.path.join('/') === base.path.join('/')) {
		if (this.query === null) {
			this.query = base.query;

			if (this.fragment === null) {
				this.fragment = base.fragment;
			}
		}
	}
};


/**
 * Return true if the scheme and the port match
 *
 * @return boolean
 */
URI.prototype.schemeAndPortMatch = function schemeAndPortMatch() {
	if (!this.port) {
		return true;
	}

	if (!this.scheme) {
		return false;
	}

	switch (this.scheme.toLowerCase()) {
	case 'http':
		return +this.port === 80;
	case 'https':
		return +this.port === 443;
	}

	return false;
};


/**
 * Convert a URI object into a string
 *
 * @return string
 */
URI.prototype.toString = function toString() {
	var str = '';

	if (this.scheme) {
		str += this.scheme + ':';
	}

	if (str || this.host) {
		str += '//';
	}

	if (this.userInfo) {
		str += this.userInfo + '@';
	}

	if (this.host) {
		str += this.host;
	}

	if (!this.schemeAndPortMatch()) {
		str += ':' + this.port;
	}

	if (this.path || this.host) {
		str += '/';
	}

	if (this.path) {
		str += this.path.join('/').substr(1);
	}

	if (this.query) {
		str += '?' + this.query;
	}

	if (this.fragment) {
		str += '#' + this.fragment;
	}

	return str;
};

module.exports = URI;

});

require.define("/util.js",function(require,module,exports,__dirname,__filename,process,global){'use strict';

var util;

util = {
	/**
	 * Clones an object.  Don't send a recursive object in here.
	 * Clones data only.
	 *
	 * @param mixed src
	 * @return mixed Copy of src
	 */
	clone: function clone(src) {
		var target, myself;

		if (Array.isArray(src)) {
			target = [];
			Array.prototype.forEach.call(src, function (val, key) {
				target[key] = util.clone(val);
			});
		} else if (typeof src === 'object') {
			target = {};
			Object.keys(src).forEach(function (key) {
				target[key] = util.clone(src[key]);
			});
		} else {
			target = src;
		}

		return target;
	},

	/**
	 * Iterate across an object's properties, like Array.prototype.forEach
	 *
	 * @param object object
	 * @param Function callback (value, propertyName, object)
	 * @param object|null thisRef
	 */
	iterate: function iterate(object, callback, thisRef) {
		var propName;

		for (propName in object) {
			if (Object.prototype.hasOwnProperty.call(object, propName)) {
				callback.call(thisRef, object[propName], propName, object);
			}
		}
	}
};

module.exports = util;

});

require.define("/jsonschemaprovider.js",function(require,module,exports,__dirname,__filename,process,global){/**
 * JSON Schema Provider object
 *
 * This is responsible for retrieving a JSON Schema file (raw text),
 * converting it to a JSON object, then converting it into JSONSchema objects.
 *
 * Usage:
 *
 * var JSONSchemaProvider, provider;
 * JSONSChemaProvider = require('./jsonschemaprovider');
 * // Use jQuery's AJAX to fetch/parse JSON files
 * provider = new JSONSchemaProvider(JSONSchemaProvider.jQuery);
 */
/*global jQuery*/
'use strict';

var JSONSchema, URI, util;

JSONSchema = require('./jsonschema');
URI = require('./uri');
util = require('./util');

/**
 * Create a new Schema object
 *
 * Use something like this:
 *    var provider = new JSONSchemaProvider(JSONSchemaProvider.jQuery);
 *
 * @param Function method How we are to fetch schemas
 */
function JSONSchemaProvider(method) {
	// Allow people to omit the 'new' keyword
	if (!(this instanceof JSONSchemaProvider)) {
		return new JSONSchemaProvider(method);
	}

	this.providerMethod = method;
	this.rawCache = {};  // Raw JSON objects
	this.processedCache = {};
}


/**
 * Fetch a schema (not JSONSchema object) with jQuery
 *
 * @param String uri
 * @param Function callback (err, data)
 */
JSONSchemaProvider.jQuery = function provider_jQuery(uri, callback) {
	jQuery.ajax(uri, {
		accepts: 'application/vnd.hapi+json, application/json;q=0.8',
		dataType: 'text json',
		error: function (jqXHR, textStatus, errorThrown) {
			callback(errorThrown);
		},
		success: function (data, textStatus, jqXHR) {
			callback(null, data);
		}
	});
};


/**
 * Fetch a schema (not JSONSchema object) and use a cache for speed.
 *
 * @param String uri May contain a hash, which this strips
 * @param Function callback (err, data)
 */
JSONSchemaProvider.prototype.fetch = function fetch(uri, callback) {
	var cleanUri = uri.split('#')[0],
		myself = this,
		jsonPointer = uri.split('#')[1];

	if (this.rawCache[cleanUri]) {
		this.resolvePointer(this.rawCache[cleanUri], uri, jsonPointer, callback);
		return;
	}

	this.providerMethod(uri, function (err, data) {
		if (err) {
			callback(err);
		} else {
			myself.rawCache[cleanUri] = data;
			myself.resolvePointer(myself.rawCache[cleanUri], uri, jsonPointer, callback);
		}
	});
};


/**
 * Load a schema.  This consists of:
 *  - fetching an unprocessed schema
 *  - iterating over the properties and filling in $ref links
 *  - convert the raw data to JSONSchema objects
 *
 * @param string|URI uri URI of schema
 * @param string|URI baseUri Base URI for relative links (optional)
 * @param Function callback (err, JSONSchema)
 */
JSONSchemaProvider.prototype.load = function load(uri, baseUri, callback) {
	var myself = this,
		parsedUri;

	if (callback === undefined) {
		callback = baseUri;
		parsedUri = URI(uri).toString();
	} else {
		parsedUri = URI(uri, baseUri).toString();
	}

	if (this.processedCache[parsedUri]) {
		callback(null, this.processedCache[parsedUri]);
		return;
	}

	this.fetch(parsedUri, function (err, data) {
		var js;

		if (err) {
			callback(err);
		} else {
			js = new JSONSchema(parsedUri, data);
			myself.processedCache[parsedUri] = js;
			js.resolve(function fetcher(uri, callback) {
				// Change scope and then fetch the right URI
				myself.fetch.call(myself, uri, callback);
			}, callback);
		}
	});
};


/**
 * Walk down an object using a JSON Pointer.  Returns the ending object to
 * the callback.
 *
 * @param Object schema
 * @param string uri For error message purposes
 * @param string pointer
 * @param Function callback
 */
JSONSchemaProvider.prototype.resolvePointer = function resolvePointer(schema, uri, pointer, callback) {
	var pointers;

	if (!pointer) {
		// Nothing to resolve
		callback(null, util.clone(schema));
		return;
	}

	pointers = pointer.explode('/');

	if (pointers[0] !== '') {
		callback(new Error('Invalid JSON Pointer (' + pointer + ') in uri (' + uri + ')'));
		return;
	}

	pointers.shift();

	if (!pointers.every(function (segment) {
			// Unescape
			segment = segment.replace(/~1/g, '/').replace(/~0/g, '~');

			if (Array.isArray(schema)) {
				segment = +segment;  // Force to be numeric
			}

			schema = schema[segment];

			// We should always land on an array or object.
			// Luckily, typeof [] === 'object'
			return (typeof schema === 'object');
		})) {
		callback(new Error('JSON pointer (' + pointer + ') resolves to invalid location in uri (' + uri + ')'));
		return;
	}

	callback(null, util.clone(schema));
};


module.exports = JSONSchemaProvider;

});
require("/jsonschemaprovider.js");
