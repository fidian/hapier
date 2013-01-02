/*global window*/
(function () {
	'use strict';


	function indentation(num) {
		var out = '\n';

		while (num) {
			num -= 1;
			out += '\t';
		}

		return out;
	}


	function jsonFormatter(input) {
		var c, escaped, i, indent, inString, output;

		output = '';
		inString = null;
		escaped = false;
		indent = 0;

		for (i = 0; i < input.length; i += 1) {
			c = input.charAt(i);

			if (inString) {
				// We only care when we leave a string or when we have
				// to handle escaped things
				if (escaped) {
					escaped = false;
				} else if (c === '\\') {
					escaped = true;
				} else if (c === '"') {
					inString = false;
				}

				output += c;
			} else {
				switch (c) {
				case '{':
				case '[':
					indent += 1;
					output += c + indentation(indent);
					break;

				case '}':
				case ']':
					indent -= 1;
					output += indentation(indent) + c;
					break;

				case "\n":
				case "\t":
				case " ":
					break;

				case ":":
					output += c + ' ';
					break;

				case ',':
					output += c + indentation(indent);
					break;

				case '"':
					inString = true;
					output += c;
					break;

				default:
					output += c;
				}
			}
		}

		return output;
	}


	if (typeof window === 'object') {
		window.jsonFormatter = jsonFormatter;
	}
}());
