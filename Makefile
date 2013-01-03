TARGETS = js-client/client/bundle.js
TESTS = js-client_test
.PHONY: clean test $(TESTS)

all: $(TARGETS)

test: $(TESTS)

js-client/client/bundle.js: js-client/*.js
	node_modules/.bin/browserify js-client/jsonschemaprovider.js -o js-client/client/bundle.js --exports=require
js-client_test:
	cd js-client && ../node_modules/.bin/vows --isolate

clean: $(TARGETS)
	rm -f $(TARGETS)
