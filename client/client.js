/*global $, document, ich, jsonFormatter, TemplateJQuery, window*/

$(function () {
	'use strict';
	var config, client, dcp, JSONSchemaProvider, URI;


	URI = require('/uri.js');


	function isObject(x) {
		return typeof x === 'object' && x !== null;
	}


	/**
	 * Constructor for the client
	 *
	 * @param object config Can override object's defaultConfig
	 */
	function DebugClient(config) {
		if (!isObject(config)) {
			config = {};
		}

		this.config = $.extend({}, this.defaultConfig, config);
	}


	dcp = DebugClient.prototype;


	/**
	 * Display a message (based on a code) and possibly highlight
	 * a field as being in error.
	 *
	 * @param string code
	 * @param jQuery $field
	 */
	dcp.addError = function addError(code, $field) {
		var $message, dataForRender;

		dataForRender = {
			code: code
		};
		dataForRender[code] = code;
		$message = this.renderTemplate('error_message', dataForRender);
		$("#error_messages").empty().append($message);

		if ($field) {
			$field.addClass('error');
		}
	};


	/**
	 * Build actions for a given set of headers/content
	 *
	 * @param object headers
	 * @param object content
	 * @return jQuery Rendered template
	 */
	dcp.buildActions = function buildActions(headers, content) {
		var actions, linksName, $rendered;

		actions = [];
		linksName = '_links';

		function addAction(action) {
			actions.push(action);
		}

		if (!isObject(headers)) {
			headers = {};
		}

		if (!isObject(content)) {
			content = {};
		}

		// Look for links
		if (isObject(content[linksName])) {
			this.buildActionType(content[linksName].create, addAction, function (linkDef, addCallback) {
				addCallback({
					label: 'Create resource: ' + linkDef.href + ' [' + linkDef.schema + ']',
					callback: this.getFormEditFunction(linkDef)
				});
				addCallback({
					label: 'See create schema: ' + linkDef.schema,
					callback: function () {
						this.makeRequest('GET', linkDef.schema);
					}
				});
			});

			this.buildActionType(content[linksName].describedby, addAction, function (linkDef, addCallback) {
				addCallback({
					label: 'See described by schema: ' + linkDef.href,
					callback: function () {
						this.makeRequest('GET', linkDef.href);
					}
				});
			});
		}

		if (headers.Location) {
			addAction({
				label: 'Follow location header: ' + headers.Location,
				id: 'action_location',
				callback: function () {
					this.makeRequest('GET', headers.Location);
				}
			});
		}

		// We can always use GET and OPTIONS
		addAction({
			label: 'Get current URI: ' + this.config.currentUri,
			id: 'action_get',
			callback: function () {
				this.makeRequest('GET', this.config.currentUri);
			}
		});
		addAction({
			label: 'See options: ' + this.config.currentUri,
			id: 'action_options',
			callback: function () {
				this.makeRequest('OPTIONS', this.config.currentUri);
			}
		});

		// Build template and add actions
		$rendered = $('<div />');
		actions.forEach(function (action) {
			var myself, $template;

			myself = this;
			$template = this.renderTemplate('action', action);
			$template.on('click', function () {
				action.callback.call(myself);
				return false;
			});
			$rendered.append($template);
		}, this);

		return $rendered.children();
	};


	/**
	 * Build a single action
	 *
	 * The links can be arrays or regular objects.  This function merely will
	 * call your actionBuilder callback in a loop or once
	 *
	 * @param Array|object linkDef
	 * @param Function actionBuilder(linkDef)
	 * @param Function addCallback(action)
	 */
	dcp.buildActionType = function buildActionType(linkDef, addCallback, actionBuilder) {
		if (Array.isArray(linkDef)) {
			linkDef.forEach(function (subLinkDef) {
				this.buildActionType(subLinkDef, addCallback, actionBuilder);
			}, this);
		} else if (typeof linkDef === 'object' && linkDef !== null) {
			actionBuilder.call(this, linkDef, addCallback);
		}
	};


	/**
	 * Clear errors from the page
	 */
	dcp.clearErrors = function clearErrors() {
		this.config.pageContainer.find('.error').removeClass('error');
		this.config.pageContainer.find('.error_messages').remove();
	};


	/**
	 * Set up our initial configuration for the client
	 */
	dcp.defaultConfig = {
		accepts: $.extend({}, $.ajaxSettings.accepts),
		contentType: 'application/json',
		currentUri: null,
		dataType: "json",
		pageContainer: $('body'),
		password: '',
		requestContainer: $([]),
		responseContainer: $([]),
		templater: null,
		timeout: 10000,
		username: ''
	};


	/**
	 * Return a function that is specifically for editing a form
	 */
	dcp.getFormEditFunction = function getFormEditFunction(linkDef) {
		var myself = this;

		return function () {
			function schemaLoaded(err, schema) {
				var $form, template;

				if (err) {
					myself.addError('schema_load');
					return;
				}

				$form = $('<form>');
				template = myself.config.templater.fromSchema(schema);
				$form.append(template.rendered);
				$form.append('<input type="submit">');
				$form.on('submit', function () {
					var formData;

					formData = template.get();

					if (schema.validate(formData, function (path, code, message) {
							myself.addError('schema_validate');
						})) {
						myself.config.currentUri = linkDef.href;
						myself.makeRequest('POST', linkDef.href, formData);
					}

					return false;
				});
				myself.showPage($form);
			}

			myself.showPage(myself.renderTemplate('loading'));
			myself.config.schemaProvider.load(linkDef.schema, myself.config.currentUri, schemaLoaded);
		};
	};


	/**
	 * Log a response
	 *
	 * Formats data as is necessary for logTraffic
	 *
	 * @param jqXHR jqXHR
	 */
	dcp.logResponse = function logResponse(jqXHR) {
		var body, headers, headerObj;

		headers = jqXHR.getAllResponseHeaders();
		headerObj = this.parseHeaders(headers);

		if (jqXHR.responseText) {
			body = jqXHR.responseText;
		} else if (jqXHR.responseXml) {
			body = jqXHR.responseXml;
		} else {
			body = null;
		}

		this.logTraffic('response', headerObj, body);
	};


	/**
	 * Log the last request
	 *
	 * @param string type "request" or "response"
	 * @param object headers
	 * @param string payload
	 * @param string method GET, POST, etc, optional
	 * @param string url Specified if method is specified
	 */
	dcp.logTraffic = function logTraffic(type, headers, payload, method, url) {
		var $container, $template, templateData;

		templateData = {
			headers: [],
			body: payload,
			pretty: null
		};

		if (method) {
			templateData.method = method;
			templateData.url = url;
		}

		// Attempt to beautify the text
		if (payload) {
			if (payload.match(/^[\-.0-9"{]/)) {
				// Might this be JSON?
				try {
					JSON.parse(payload);
					templateData.pretty = jsonFormatter(payload);
				} catch (e) {
					// Ignore
				}
			}
		}

		Object.keys(headers).sort().forEach(function (name) {
			templateData.headers.push({
				name: name,
				value: headers[name]
			});
		});
		$container = this.config[type + 'Container'];

		if ($container) {
			$template = this.renderTemplate('log_traffic', templateData);
			$container.append($template);
		}
	};


	/**
	 * Make a request
	 *
	 * @param string method GET, POST, PUT, DELETE, OPTIONS
	 * @param string relativeUrl URL relative to this.currentUri
	 * @param object data
	 */
	dcp.makeRequest = function makeRequest(method, relativeUrl, data) {
		var myself, resolvedUrl, settings;

		myself = this;
		resolvedUrl = new URI(relativeUrl, this.config.currentUri);
		settings = {
			accepts: this.config.accepts,
			data: data,  // This can be used for GET requests too
			dataType: this.config.dataType,
			error: this.requestError.bind(this),
			success: this.requestSuccess.bind(this),
			type: method,
			url: resolvedUrl.toString(),
			xhr: this.xhr.bind(this)
		};

		// Prepare various places
		this.config.requestContainer.empty();
		this.config.responseContainer.empty();
		this.showPage(this.renderTemplate('loading', settings));

		['username', 'password'].forEach(function (name) {
			if (myself.config[name]) {
				settings[name] = myself.config[name];
			}
		});

		if (method === 'POST' || method === 'PUT') {
			settings.contentType = this.config.contentType;
		}

		$.ajax(resolvedUrl.toString(), settings);
	};


	/**
	 * Parse a single string containing all headers and
	 * - split into separate properties on an object
	 * - standardize the property's capitalization
	 *
	 * Because of sheer personal preference, property names will be in
	 * PascalCase (like camelCase, but with a leading capitalized letter)
	 * based on hyphenation.
	 *
	 * @param object headerStr Headers as a string
	 * @return object Renamed headers
	 */
	dcp.parseHeaders = function parseHeaders(headerStr) {
		var headers;

		function pascalCase(str) {
			return str.substr(0, 1).toUpperCase() + str.substr(1).toLowerCase();
		}

		headers = {};

		// Remove "continuation" ensuring it's one line per header
		headerStr = headerStr.replace(/(\r?\n|\r)[ \t]+/g, ' ').trim();
		headerStr.split(/\r?\n|\r/).forEach(function (headerLine) {
			var fixedName, name, value;

			name = headerLine.split(':', 1)[0];
			value = headerLine.substr(name.length + 1);
			name = name.trim();
			value = value.trim();
			fixedName = [];
			name.split('-').forEach(function (val) {
				fixedName.push(pascalCase(val));
			});
			fixedName = fixedName.join('-');
			headers[fixedName] = value;
		});

		return headers;
	};


	/**
	 * Render a template with some arbitrary data
	 *
	 * @param string name
	 * @param object data Data for rendering, optional
	 * @return jQuery Rendered template
	 */
	dcp.renderTemplate = function renderTemplate(name, data) {
		var html;

		if (data === undefined) {
			data = {};
		}

		if (!Object.prototype.hasOwnProperty.call(ich, name)) {
			throw new Error('Invalid template name: ' + name);
		}

		if (typeof ich[name] !== 'function') {
			throw new Error('Template ' + name + ' is not a function');
		}

		// Get the raw HTML here to avoid dropping text nodes
		html = ich[name](data, true);
		return $('<div>').addClass('template').attr('name', name).html(html);
	};


	/**
	 * A request resulted in an error
	 *
	 * Do not use addError here since we want to show everything about it
	 *
	 * @param jqXHR jqXHR
	 * @param string textStatus
	 * @param string|Exception errorThrown FIXME - what data type is this?
	 */
	dcp.requestError = function requestError(jqXHR, textStatus, errorThrown) {
		var $content, headerObj, headers, templateData;

		this.logResponse(jqXHR);
		headers = jqXHR.getAllResponseHeaders();
		headerObj = this.parseHeaders(headers);
		templateData = {
			errorThrown: errorThrown,
			status: jqXHR.status,
			textStatus: textStatus
		};

		if (typeof templateData.errorThrown !== 'string') {
			templateData.errorThrown = templateData.errorThrown.toString();
		}

		$content = this.renderTemplate('request_error', templateData);
		$content.after(this.buildActions(headerObj, {}));
		this.showPage($content);
	};


	/**
	 * A good request
	 *
	 * @param mixed data Hopefully an object
	 * @param string textStatus
	 * @param jqXHR jqXHR
	 */
	dcp.requestSuccess = function requestSuccess(data, textStatus, jqXHR) {
		var $content, headers, headerObj;

		this.logResponse(jqXHR);
		headers = jqXHR.getAllResponseHeaders();
		headerObj = this.parseHeaders(headers);
		$content = this.buildActions(headerObj, data);
		this.showPage($content);
	};


	/**
	 * Show a page with the given content
	 *
	 * @param content Content to append
	 */
	dcp.showPage = function showPage(content) {
		this.config.pageContainer.empty().append(content);
	};


	/**
	 * Welcome!
	 *
	 * When beginning, show the API URL selection template
	 */
	dcp.startClient = function startClient() {
		var $form, $field, myself;

		myself = this;
		$('#tabs').tabs();
		$form = this.renderTemplate('start_debug_client');
		$field = $form.find('[name="url"]');
		$field.val(this.startingUrl());

		function submitForm(e) {
			var apiUrl;

			apiUrl = $field.val();
			myself.clearErrors();

			if (!apiUrl) {
				myself.addError('invalid_api_url', $field);
				return;
			}

			myself.startingUrl(apiUrl);
			myself.config.currentUri = apiUrl;
			myself.showPage(myself.buildActions());
			return false;
		}

		$form.on('click', '.button', submitForm);
		$form.on('submit', submitForm);
		this.showPage($form);
		$field.focus();
	};


	/**
	 * Get or set the starting URL.  This is persisted in the user's
	 * browser.
	 *
	 * @param undefined|string set
	 * @return string URL
	 */
	dcp.startingUrl = function startingUrl(set) {
		var key, val;

		key = 'startingApiUrl';

		if (set === undefined) {
			val = $.totalStorage(key);

			if (!val) {
				val = document.location.toString();
				$.totalStorage(key, val);
			}

			return val;
		}

		$.totalStorage(key, set);
		return set;
	};


	/**
	 * Fake XHR object for logging without hacking jQuery
	 */
	dcp.xhr = function xhr() {
		var headers, method, myself, req, realOpen, realSRH, realSend, url;

		myself = this;
		method = null;
		headers = {};
		req = $.ajaxSettings.xhr();
		url = null;

		// .open(method, url, etc)
		realOpen = req.open;
		req.open = function (openMethod, openUrl) {
			var args;
			method = openMethod;
			url = openUrl;
			args = Array.prototype.slice.call(arguments, 0);
			return realOpen.apply(this, args);
		};

		// .setRequestHeader(name, value)
		realSRH = req.setRequestHeader;
		req.setRequestHeader = function (header, value) {
			headers[header] = value;
			return realSRH.call(this, header, value);
		};

		// .send(data|null)
		realSend = req.send;
		req.send = function (payload) {
			myself.logTraffic('request', headers, payload, method, url);
			return realSend.call(this, payload);
		};

		return req;
	};


	JSONSchemaProvider = require('/jsonschemaprovider');
	client = new DebugClient({
		requestContainer: $('#lastRequest'),
		responseContainer: $('#lastResponse'),
		pageContainer: $('#page'),
		schemaProvider: new JSONSchemaProvider(JSONSchemaProvider.jQuery),
		templater: new TemplateJQuery()
	});
	client.startClient();
});
