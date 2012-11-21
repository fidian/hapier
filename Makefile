TESTS = js-client_test
.PHONY: test $(TESTS)

all:

test: $(TESTS)

js-client_test:
	cd js-client && ../node_modules/.bin/vows --isolate
