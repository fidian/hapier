.PHONY: clean

all: client/hapier.js

client/hapier.js: jsonschema.js jsonschemaprovider.js simplenotify.js uri.js util.js
	../node_modules/.bin/browserify -o client/hapier.js jsonschema.js jsonschemaprovider.js

clean:
	rm client/hapier.js
