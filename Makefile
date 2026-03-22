.PHONY: serve clean

# Open the game locally (Python simple server)
serve:
	python3 -m http.server 8080

clean:
	rm -rf node_modules/
