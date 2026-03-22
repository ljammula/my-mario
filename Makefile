.PHONY: install dev build preview test test-watch coverage deploy clean

install:
	npm install

dev:
	npx vite --port 3000

build:
	npx tsc --noEmit && npx vite build

preview:
	npx vite preview

test:
	npx vitest run

test-watch:
	npx vitest

coverage:
	npx vitest run --coverage

deploy:
	npx tsc --noEmit && npx vite build

clean:
	rm -rf docs/ node_modules/
