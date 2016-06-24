#!/bin/sh
node_modules/watchify/bin/cmd.js rpg.js -o bundle.js &
node_modules/node-sass/bin/node-sass style.scss -wo . --source-map . &
node_modules/live-server/live-server.js .
