# Copyright (C) 2022  Landon Harris
# Copyright (C) 2026  Jiaqi Chen (n0rbury)

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License along
# with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
SHELL := /bin/bash

dbclib := dbcLib/dist/index.js
client := client/build/ext-src/serverPack.js
server := server/dist/serverPack.js

all: syntaxes $(dbclib) $(client) $(server)
client: $(client)
server: $(server)
dbclib: $(dbclib)

$(dbclib): $(shell find dbcLib/src -name "*.ts") dbcLib/package.json
	cd dbcLib && npx tsc && npx webpack --mode production

$(client): $(dbclib) $(shell find client/src client/ext-src -name "*.ts" -o -name "*.tsx" -o -name "*.css") client/package.json
	cd client && CI=true npm run build

$(server): $(dbclib) $(shell find server/src -name "*.ts") server/dbc.jison server/dbc.lex server/package.json
	cd server && npm run build


.PHONY: syntaxes
syntaxes: syntaxes/dbc.tmLanguage.json snippets/snippets.json

syntaxes/dbc.tmLanguage.json: syntaxSrc/dbcLang.yml
	npx js-yaml syntaxSrc/dbcLang.yml > syntaxes/dbc.tmLanguage.json

snippets/snippets.json: syntaxSrc/snippets.yml
	npx js-yaml syntaxSrc/snippets.yml > snippets/snippets.json

.PHONY: clean
clean:
	rm -f syntaxes/dbc.tmLanguage.json snippets/snippets.json
	rm -rf client/build client/dist
	rm -rf dbcLib/build dbcLib/dist
	rm -rf server/dist server/out server/src/parser.ts server/src/lexer.ts
	rm -f *.vsix

.PHONY: package
package: all
	npx vsce package
