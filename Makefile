TARGETS = js-client/client/hapier.js
TESTS = js-client_test
.PHONY: clean test $(TESTS)

all: $(TARGETS)

test: $(TESTS)

js-client/client/hapier.js: js-client/*.js
	node_modules/.bin/browserify js-client/jsonschemaprovider.js -o js-client/client/hapier.js --exports=require
js-client_test:
	cd js-client && ../node_modules/.bin/vows --isolate

clean: $(TARGETS)
	rm -f $(TARGETS)
