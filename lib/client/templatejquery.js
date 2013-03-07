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


	TemplateJQuery.prototype.blankElement = function blankElement(subclass, elementType) {
		if (elementType === undefined) {
			elementType = 'div';
		}

		return $('<' + elementType + ' />').addClass('template-element').addClass('template-element-' + subclass);
	};


	TemplateJQuery.prototype.blankObject = function blankObject(schema) {
		return {
			get: function () {
			},
			rendered: $(),
			set: function (val) {
			}
		};
	};


	TemplateJQuery.prototype.enumOptions = function enumOptions(schema) {
		var options, $template, $select;

		if (!schema || !schema.getEnum() || schema.getEnum().length < 1) {
			return null;
		}

		if (schema.getTitle() !== null) {
			$template.append(this.makeLabel(schema.getTitle()));
		}

		$template = this.blankElement('enum');
		$select = $('<select>');
		options = [];
		schema.getEnum().forEach(function (val) {
			var $opt;
			$opt = $('<option/>');

			// FIXME: this only works for simple types, not objects nor arrays
			$opt.text(val.toString());
			$opt.attr('value', options.length);
			$select.append($opt);

			options.push({
				$option: $opt,
				data: val
			});
		});

		if (schema.getDefault()) {
			options.forEach(function (opt, key) {
				if (schema.compare(opt.data, schema.getDefault())) {
					$select.val(key);
				}
			});
		}

		$template.append($select);

		if (schema.getDescription()) {
			$template.append($('<span />').addClass('description').text(schema.getDescription().toString()));
		}

		return {
			get: function () {
				return options[$select.val()].data;
			},
			rendered: $template,
			set: function (val) {
				options.forEach(function (option, key) {
					if (schema.compare(option.data, val)) {
						$select.val(option, key);
					}
				});
			}
		};
	};


	TemplateJQuery.prototype.fromSchema = function fromSchema(schema, parentSchema, propName) {
		var result, type;

		result = this.blankObject(schema);
		type = schema.getType();
		console.log(type);

		// Type can either be an array of types or a single type,
		// but the JSONSchema object normalizes this to an array
		if (type.length === 1) {
			if (schema.isSimpleType(type[0])) {
				// Simple types are a set of strings or "any"
				if (this['type_' + type[0]]) {
					result = this['type_' + type[0]].call(this, schema, parentSchema, propName);
				}
				// This should always work for all simple types
			}
			// More complex types should be handed by extending this object
		}

		// TODO:  Implement - type.length > 1

		return result;
	};


	TemplateJQuery.prototype.makeLabel = function makeLabel(text) {
		var $label;

		$label = $('<label />');
		$label.addClass('template-element-label');
		$label.append($('<span />').text(text));
		return $label;
	};


	TemplateJQuery.prototype.type_any = function type_any(schema, parentSchema, propName) {
		return this.blankObject(schema);
	};


	TemplateJQuery.prototype.type_array = function type_array(schema, parentSchema, propName) {
		return this.blankObject(schema);
	};


	TemplateJQuery.prototype.type_boolean = function type_boolean(schema, parentSchema, propName) {
		var def, $input, $view;

		$view = this.blankElement('boolean');
		$input = $('<input type="checkbox">');

		if (schema.getDefault()) {
			$input.prop('checked', true);
		}

		if (schema.getTitle()) {
			$view.append(this.makeLabel(schema.getTitle()).prepend($input));
		} else {
			$view.append($input);
		}

		if (schema.getDescription()) {
			$view.append($('<span />').addClass('description').text(schema.getDescription().toString()));
		}


		return {
			get: function () {
				return !!$input.prop('checked');
			},
			rendered: $view,
			set: function (val) {
				$input.prop('checked', !!val);
			}
		};
	};


	TemplateJQuery.prototype.type_integer = function type_integer(schema, parentSchema, propName) {
		var def, $input, $view, enumObj;

		enumObj = this.enumOptions(schema);

		if (enumObj) {
			return enumObj;
		}

		$view = this.blankElement('integer');
		$input = $('<input type="number">');

		if (schema.getDefault()) {
			def = schema.getDefault();
			def = +def;  // Force to be a number
			def = Math.round(def);  // Force to be an integer
			$input.val(def.toString());
		}

		if (schema.getDescription()) {
			$input.attr('placeholder', schema.getDescription().toString());
		}

		if (schema.getTitle()) {
			$view.append(this.makeLabel(schema.getTitle()).append($input));
		} else {
			$view.append($input);
		}

		return {
			get: function () {
				return +$input.val();
			},
			rendered: $view,
			set: function (val) {
				if (typeof val !== 'number') {
					val = 0;
				}

				val = +val;
				val = Math.floor(val);
				$input.val(val.toString());
			}
		};
	};


	TemplateJQuery.prototype.type_null = function type_null(schema, parentSchema, propName) {
		var blank;

		blank = this.blankObject(schema);
		blank.get = function () {
			return null;
		};
		return blank;
	};


	TemplateJQuery.prototype.type_number = function type_number(schema, parentSchema, propName) {
		var def, $input, $view, enumObj;

		enumObj = this.enumOptions(schema);

		if (enumObj) {
			return enumObj;
		}

		$view = this.blankElement('number');
		$input = $('<input type="number">');

		if (schema.getDefault()) {
			def = schema.getDefault();
			def = +def;  // Force to be a number
			$input.val(def.toString());
		}

		if (schema.getDescription()) {
			$input.attr('placeholder', schema.getDescription().toString());
		}

		if (schema.getTitle()) {
			$view.append(this.makeLabel(schema.getTitle()).append($input));
		} else {
			$view.append($input);
		}

		return {
			get: function () {
				return +$input.val();
			},
			rendered: $view,
			set: function (val) {
				if (typeof val !== 'number') {
					val = 0;
				}

				$input.val(val.toString());
			}
		};
	};


	TemplateJQuery.prototype.type_object = function type_object(schema, parentSchema, propName) {
		var children, desc, myself, $view;

		if (!isObject(schema.getProperties())) {
			// TODO:  handle better?
			return this.blankObject(schema);
		}

		myself = this;
		$view = this.blankElement('object', 'fieldset');
		children = [];

		if (parentSchema) {
			desc = propName;

			if (parentSchema.getDescription()) {
				desc = parentSchema.getDescription();
			}

			if (parentSchema.getTitle()) {
				desc = parentSchema.getTitle();
			}

			$view.append($('<legend>').text(desc));
		}

		if (schema.getDescription()) {
			$view.append(this.makeLabel(schema.getDescription()));
		}

		Object.keys(schema.getProperties()).forEach(function (propName) {
			var newChild;

			newChild = myself.fromSchema(schema.getProperties()[propName], schema, propName);
			children.push({
				name: propName,
				template: newChild
			});
			$view.append(newChild.rendered);
		});

		function getter() {
			var result;

			result = {};
			children.forEach(function (child) {
				result[child.name] = child.template.get();
			});

			return result;
		}

		return {
			get: getter,
			rendered: $view,
			set: function (val) {
				if (!isObject(val)) {
					val = {};
				}

				children.forEach(function (child) {
					child.template.set(val[child.name]);
				});
			}
		};
	};


	TemplateJQuery.prototype.type_string = function type_string(schema, parentSchema, propName) {
		var currentValue, $input, $view, enumObj;

		enumObj = this.enumOptions(schema);

		if (enumObj) {
			return enumObj;
		}

		currentValue = '';
		$view = this.blankElement('string');
		$input = $('<input type="text">');

		if (schema.getDefault()) {
			$input.val(schema.getDefault().toString());
		}

		if (schema.getDescription()) {
			$input.attr('placeholder', schema.getDescription().toString());
		}

		if (schema.getTitle()) {
			$view.append(this.makeLabel(schema.getTitle()).append($input));
		} else {
			$view.append($input);
		}

		return {
			get: function () {
				return currentValue;
			},
			rendered: $view,
			set: function (val) {
				currentValue = val.toString();
			}
		};
	};


	if (isObject(window)) {
		window.TemplateJQuery = TemplateJQuery;
	}
}());
