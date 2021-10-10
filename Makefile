eslint_files = *.js *.json

.PHONY: check-fmt
check-fmt:
	npx eslint $(eslint_files)

.PHONY: fmt
fmt:
	npx eslint --fix $(eslint_files)
