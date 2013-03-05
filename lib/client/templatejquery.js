/**
 * Template object that will create HTML-ish fragments for various
 * schema types.
 */
/*global $, window*/
(function () {
	'use strict';


	function isObject(val) {
		return typeof val === 'object' && val !== null;
	}


	function TemplateJQuery() {
	}


	TemplateJQuery.prototype.blankElement = function blankElement() {
		return $('<div />').addClass('template-element');
	};


	TemplateJQuery.prototype.blankObject = function blankObject(schema) {
		return {
			get: function () {
			},
			isValid: function () {
				return true;
			},
			rendered: $(),
			set: function (val) {
			}
		};
	};


	TemplateJQuery.prototype.fromSchema = function fromSchema(schema) {
		var type;

		type = schema.type;

		// Type can either be an array of types or a single type
		if (Array.isArray(type)) {
			// TODO:  Implement
			return this.blankObject(schema);
		}

		// Single types can either be a schema or a simple type
		if (schema.isSimpleType(type)) {
			// Simple types are a set of strings or "any"
			if (this['type_' + type]) {
				return this['type_' + type](schema);
			}
		}

		return this.blankObject;
	};


	TemplateJQuery.prototype.makeLabel = function makeLabel(text) {
		var $label;

		$label = $('<label />');
		$label.addClass('template-element-label');
		$label.append($('<span />').text(text));
		return $label;
	};


	TemplateJQuery.prototype.type_any = function type_any(schema) {
		return this.blankObject(schema);
	};


	TemplateJQuery.prototype.type_array = function type_array(schema) {
		return this.blankObject(schema);
	};


	TemplateJQuery.prototype.type_boolean = function type_boolean(schema) {
		var def, $input, $view;

		$view = this.blankElement();
		$input = $('<input type="checkbox">');

		if (schema.schema['default'] !== undefined) {
			if (schema.schema['default']) {
				$input.prop('checked', true);
			}
		}

		if (schema.schema.title !== undefined) {
			$view.append(this.makeLabel(schema.schema.title).prepend($input));
		} else {
			$view.append($input);
		}

		if (schema.schema.description !== undefined) {
			$view.append($('<span />').addClass('description').text(schema.schema.description.toString()));
		}


		return {
			get: function () {
				return !!$input.prop('checked');
			},
			isValid: function () {
				return true;
			},
			rendered: $view,
			set: function (val) {
				$input.prop('checked', !!val);
			}
		};
	};


	TemplateJQuery.prototype.type_integer = function type_integer(schema) {
		var def, $input, $view;

		$view = this.blankElement();
		$input = $('<input type="number">');

		if (schema.schema['default'] !== undefined) {
			def = schema.schema['default'];
			def = +def;  // Force to be a number
			def = Math.round(def);  // Force to be an integer
			$input.val(def.toString());
		}

		if (schema.schema.description !== undefined) {
			$input.attr('placeholder', schema.schema.description.toString());
		}

		if (schema.schema.title !== undefined) {
			$view.append(this.makeLabel(schema.schema.title).append($input));
		} else {
			$view.append($input);
		}

		function isValid(val) {
			if (typeof val !== 'number') {
				return false;
			}

			return true;
		}

		return {
			get: function () {
				return +$input.val();
			},
			isValid: function () {
				return isValid(+$input.val());
			},
			rendered: $view,
			set: function (val) {
				if (!isValid(val)) {
					val = 0;
				}

				val = +val;
				val = Math.floor(val);
				$input.val(val.toString());
			}
		};
	};


	TemplateJQuery.prototype.type_null = function type_null(schema) {
		var blank;

		blank = this.blankObject(schema);
		blank.get = function () {
			return null;
		};
		return blank;
	};


	TemplateJQuery.prototype.type_number = function type_number(schema) {
		var def, $input, $view;

		$view = this.blankElement();
		$input = $('<input type="number">');

		if (schema.schema['default'] !== undefined) {
			def = schema.schema['default'];
			def = +def;  // Force to be a number
			$input.val(def.toString());
		}

		if (schema.schema.description !== undefined) {
			$input.attr('placeholder', schema.schema.description.toString());
		}

		if (schema.schema.title !== undefined) {
			$view.append(this.makeLabel(schema.schema.title).append($input));
		} else {
			$view.append($input);
		}

		function isValid(val) {
			if (typeof val !== 'number') {
				return false;
			}

			return true;
		}

		return {
			get: function () {
				return +$input.val();
			},
			isValid: function () {
				return isValid(+$input.val());
			},
			rendered: $view,
			set: function (val) {
				if (!isValid(val)) {
					val = 0;
				}

				$input.val(val.toString());
			}
		};
	};


	TemplateJQuery.prototype.type_object = function type_object(schema) {
		var children, myself, $view;

		if (!isObject(schema.properties)) {
			// TODO:  handle better?
			return this.blankObject(schema);
		}

		myself = this;
		$view = this.blankElement();

		if (schema.schema.description) {
			$view.append(this.makeLabel(schema.schema.description));
		}

		Object.keys(schema.properties).forEach(function (propName) {
			children.push(myself.fromSchema(schema.properties[propName]));
			$view.append(children.rendered);
		});

		function getter() {
			var result;

			result = {};
			children.forEach(function (child) {
				result[child.name] = child.template.get();
			});

			return result;
		}

		function isValid(val) {
			if (typeof val !== 'object' || val !== null) {
				return false;
			}

			return true;
		}

		return {
			get: getter,
			isValid: function () {
				return isValid(getter());
			},
			rendered: $view,
			set: function (val) {
				if (!isValid(val)) {
					val = {};
				}

				children.forEach(function (child) {
					child.set(val[child.name]);
				});
			}
		};
	};


	TemplateJQuery.prototype.type_string = function type_string(schema) {
		var currentValue, $input, $view;

		currentValue = '';
		$view = this.blankElement();
		$input = $('<input type="text">');

		if (schema.schema['default'] !== undefined) {
			$input.val(schema.schema['default'].toString());
		}

		if (schema.schema.description !== undefined) {
			$input.attr('placeholder', schema.schema.description.toString());
		}

		if (schema.schema.title !== undefined) {
			$view.append(this.makeLabel(schema.schema.title).append($input));
		} else {
			$view.append($input);
		}

		function isValid(val) {
			if (typeof val !== 'string') {
				return false;
			}

			return true;
		}

		return {
			get: function () {
				return currentValue;
			},
			isValid: function () {
				return isValid(currentValue);
			},
			rendered: $view,
			set: function (val) {
				if (!isValid(val)) {
					val = '';
				}

				currentValue = val;
			}
		};
	};


	if (isObject(window)) {
		window.TemplateJQuery = TemplateJQuery;
	}
}());
