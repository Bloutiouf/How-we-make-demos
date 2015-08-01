var async = require('async');
var bunyan = require('bunyan');
var bunyanRequest = require('bunyan-request');
var config = require('config-path')(__dirname);
var engine = require('engine.io');
var errorhandler = require('errorhandler');
var express = require('express');
var http = require('http');
var irc = require('irc');
var path = require('path');

var logger = bunyan.createLogger({
	name: 'evoke15-game',
	serializers: bunyan.stdSerializers,
});

var Direction = {
	DOWN: 0,
	LEFT: 1,
	RIGHT: 2,
	UP: 3,
};

var UsableText = {
	NONE: '<NONE>',
	CODE: 'codes',
	GRAPHICS: 'paints',
	MUSIC: 'composes',
	BEER: 'drinks',
	GENERIC: '<GENERIC>',
};

var SCORE_SELECTED_ACTION = 1;
var SCORE_USE = 10;
var SCORE_USE_SPECIFIC_BONUS_ACTION = 5;
var SCORE_USE_GENERIC_BONUS_ACTION = 2;
var MAX_BEERS = 4;
var MAX_SCORE = 100;

function isValidPosition(x, y) {
	if (x < 0 || x >= 14) return false;
	if (y < 0 || y >= 16) return false;

	if (x >= 2 && x < 12 && y === 0) return false; // screen
	if (x >= 2 && x < 6 && y >= 4 && y < 6) return false; // table TL
	if (x >= 8 && x < 12 && y >= 4 && y < 6) return false; // table TR
	if (x >= 8 && x < 12 && y >= 8 && y < 10) return false; // table BR
	if (x >= 2 && x < 9 && y >= 14) return false; // bar

	return true;
}

function getUsable(x, y) {
	if (x >= 1 && x < 7 && y >= 3 && y < 7) return 'MUSIC'; // table TL
	if (x >= 7 && x < 13 && y >= 3 && y < 7) return 'GRAPHICS'; // table TR
	if (x >= 7 && x < 13 && y >= 7 && y < 11) return 'CODE'; // table BR
	if (x >= 1 && x < 10 && y >= 13) return 'BEER'; // bar
	return 'NONE';
}

function getRank(index) {
	if (index === 0)
		return '1st';
	if (index === 1)
		return '2nd';
	if (index === 2)
		return '3rd';
	return (index + 1) + 'th';	
}

function Character(index) {
	this.index = index;
	this.name = config.characters[index].name;
	this.x = config.characters[index].x;
	this.y = config.characters[index].y;
	this.direction = Direction.DOWN;
	this.bonusAction = config.characters[index].bonusAction;
	this.scores = {
		CODE: 0,
		GRAPHICS: 0,
		MUSIC: 0,
		BEER: 2,
	};
}

Character.prototype.executeAction = function(action) {
	var newX, newY;
	switch (action) {
		case 'DOWN':
			this.direction = Direction.DOWN;
			newY = this.y + 1;
			if (isValidPosition(this.x, newY)) {
				this.y = newY;
				return 'goes down';
			}
			return 'cannot go down';

		case 'LEFT':
			this.direction = Direction.LEFT;
			newX = this.x - 1;
			if (isValidPosition(newX, this.y)) {
				this.x = newX;
				return 'goes left';
			}
			return 'cannot go left';

		case 'RIGHT':
			this.direction = Direction.RIGHT;
			newX = this.x + 1;
			if (isValidPosition(newX, this.y)) {
				this.x = newX;
				return 'goes right';
			}
			return 'cannot go right';

		case 'UP':
			this.direction = Direction.UP;
			newY = this.y - 1;
			if (isValidPosition(this.x, newY)) {
				this.y = newY;
				return 'goes up';
			}
			return 'cannot go up';

		case 'USE':
			var usable = getUsable(this.x, this.y);
			if (usable === 'NONE')
				return 'doesn\'t use anything';
			if (usable === 'BEER') {
				if (this.scores.BEER < MAX_BEERS) {
					++this.scores.BEER;
				} else
					return 'cannot drink anymore';
			} else {
				if (this.scores.BEER === 0) {
					return 'needs beers and cannot work';
				}
				var score = SCORE_USE;
				if (this.bonusAction === usable)
					score += SCORE_USE_SPECIFIC_BONUS_ACTION;
				if (this.bonusAction === 'GENERIC')
					score += SCORE_USE_GENERIC_BONUS_ACTION;
				this.scores[usable] = Math.min(this.scores[usable] + score, MAX_SCORE);
				--this.scores.BEER;
			}
			return UsableText[usable];

		default:
			return 'does nothing';
	}
};

Character.prototype.getScore = function() {
	return this.scores.CODE + this.scores.GRAPHICS + this.scores.MUSIC;
};

Character.prototype.toDesc = function() {
	return this;
};

function Player(characters, name) {
	this.characters = characters;
	this.name = name;
	this.character = -1;
	this.action = 'IDLE';
	this.score = 0;
}

Player.prototype.getScore = function() {
	if (this.character === -1)
		return 0;
	return this.score + this.characters[this.character].getScore();
};

Player.prototype.toDesc = function() {
	return this;
};

module.exports = function(callback) {
	var characters = [
		new Character(0),
		new Character(1),
		new Character(2),
		new Character(3),
	];

	var bot;
	var masterSocket;
	var httpServer;
	var server;
	var app;

	var players = {};
	var gameStarted = false;

	function getPlayer(name) {
		var player = players[name];
		if (!player)
			player = players[name] = new Player(characters, name);
		return player;
	}

	function chooseCharacter(playerName, characterIndex) {
		var player = getPlayer(playerName);

		if (gameStarted && player.character !== -1)
			return bot.say(playerName, 'You already chose ' + characters[player.character].name + '.');

		player.character = characterIndex;
		bot.say(playerName, 'You chose ' + characters[player.character].name + '.');
		send(['player', player.toDesc()]);
	}

	function chooseAction(playerName, action) {
		var player = getPlayer(playerName);
		player.action = action;
		send(['player', player.toDesc()]);
	}

	var textHandlers = {
		'1': function(name) {
			chooseCharacter(name, 0);
		},
		'2': function(name) {
			chooseCharacter(name, 1);
		},
		'3': function(name) {
			chooseCharacter(name, 2);
		},
		'4': function(name) {
			chooseCharacter(name, 3);
		},
		'a': function(name) {
			chooseAction(name, 'LEFT');
		},
		'd': function(name) {
			chooseAction(name, 'RIGHT');
		},
		// 'i': function(name) {
		// 	chooseAction(name, 'IDLE');
		// },
		's': function(name) {
			chooseAction(name, 'DOWN');
		},
		'w': function(name) {
			chooseAction(name, 'UP');
		},
		'x': function(name) {
			chooseAction(name, 'USE');
		},
	};

	var messageHandlers = {
		'auth': function(socket, message) {
			if (message[1] === config.masterPassword) {
				socket.isMaster = true;
				masterSocket = socket;
			}
		},
		'start': function(socket) {
			if (socket === masterSocket && !gameStarted)
				startGame();
		}
	};

	var intervalId;
	function startGame() {
		gameStarted = true;
		var times = config.times;

		bot.say(config.channel, 'The demoparty is now open!');

		intervalId = setInterval(function() {
			var uniquePlayers = Object.keys(players).map(function(playerName) {
				return players[playerName];
			});

			var actions = characters.map(function(character, characterIndex) {
				var actionDescs = [];
				var characterPlayers = [];

				uniquePlayers.forEach(function(player) {
					if (player.character !== characterIndex)
						return;

					characterPlayers.push(player);

					if (actionDescs.some(function(desc) {
						if (desc.action === player.action) {
							desc.players.push(player);
							return true;
						}
					}))
						return;

					actionDescs.push({
						action: player.action,
						players: [player],
					});
				});

				var selectedActionDesc;
				if (actionDescs.length) {
					actionDescs.sort(function(a, b) {
						return b.players.length - a.players.length;
					});
					
					selectedActionDesc = actionDescs[0];
				} else
					selectedActionDesc = {
						action: 'IDLE',
						players: [],
					};

				var actionText = character.executeAction(selectedActionDesc.action);

				var result = {
					character: character,
					action: selectedActionDesc.action,
					actionText: actionText,
				};
				
				selectedActionDesc.players.forEach(function(player) {
					player.score += SCORE_SELECTED_ACTION;
				});

				return result;
			});

			--times;

			bot.say(config.channel, actions.map(function(action) {
				return action.character.name + ' ' + action.actionText;
			}).join(', ') + '.');

			logger.info({
				actions: actions,
				times: times,
			}, 'Step');

			// bot.say(config.channel, times + ' actions left!');
			send(['step', times, characters.map(function(character) {
				return character.toDesc();
			})]);

			if (times <= 0) {
				clearTimeout(intervalId);

				bot.say(config.channel, 'Submissions are now closed!');
				send(['end']);

				setTimeout(function() {
					var sortedPlayers = Object.keys(players).map(function(playerName) {
						return players[playerName];
					}).sort(function(a, b) {
						return b.score - a.score;
					});

					sortedPlayers.forEach(function(player, index) {
						bot.say(player.name, 'You are ' + getRank(index) + ' out of ' + sortedPlayers.length + ' players with ' + player.getScore() + ' points.');
					});

					var sortedCharacters = characters.slice().sort(function(a, b) {
						return b.getScore() - a.getScore();
					});
					
					sortedCharacters.forEach(function(character, index) {
						bot.say(config.channel, character.name + ' is ' + getRank(index) + ' with ' + character.getScore() + ' points.');

						var characterPlayers = sortedPlayers.filter(function(player) {
							return (player.character === character.index);
						});

						characterPlayers.forEach(function(player, index) {
							bot.say(player.name, 'You are ' + getRank(index) + ' out of ' + characterPlayers.length + ' players playing with ' + character.name + '.');
						});
					});

					logger.info({
						characters: characters,
						players: sortedPlayers,
					}, 'Winners');

					send(['winners', sortedCharacters.map(function(character) {
						return character.toDesc();
					}), sortedPlayers.slice(0, 5)]);
				}, config.stepPeriod + 8000);
			}
		}, config.stepPeriod);
	}

	function send(args) {
		var message = JSON.stringify(args);
		for (var id in server.clients)
			server.clients[id].send(message);
	}

	return async.parallel([
		config.mockIrc ? function(callback) {
			bot = {
				say: console.log
			};

			var texts = Object.keys(textHandlers);

			function spawn(name) {
				process.nextTick(function() {
					textHandlers['1'](name);
				});

				setInterval(function() {
					var n = Math.floor(Math.random() * texts.length);
					textHandlers[texts[n]](name);
				}, 1000 + Math.random() * 5000);
			}

			var abc = 'abcdefghijklmnopqrstuvwxyz';
			for (var i = 0; i < abc.length; ++i)
				spawn(abc[i]);

			return callback();
		} : function(callback) {
			var firstRegistration = false;
			bot = new irc.Client(null, null, config.irc);

			bot.addListener('registered', function() {
				if (!firstRegistration) {
					firstRegistration = true;
					return callback();
				}
			});

			bot.addListener('raw', function(message) {
				logger.info({
					message: message,
				}, 'IRC message');
			});

			bot.addListener('error', function(err) {
				logger.error({
					err: err
				}, 'IRC error');
			});

			bot.addListener('message', function(from, to, text, message) {
				if (to === config.channel) {
					var textHandle = text[0] && text[0].toLowerCase();
					var textHandler = textHandlers[textHandle];
					if (textHandler)
						textHandler(from);
				}
			});

			bot.addListener('nick', function(oldNick, newNick) {
				var player = players[oldNick];
				if (player) {
					delete players[oldNick];
					player.name = newNick;
					players[newNick] = player;
					send(['nick', oldNick, newNick]);
				}
			});

			bot.addListener('part' + config.channel, function(nick) {
				var player = players[nick];
				if (player) {
					delete players[nick];
					send(['part', nick]);
				}
			});

		},
		function(callback) {
			app = express();

			app.use(bunyanRequest({
				logger: logger,
			}));

			app.use(express.static(path.join(__dirname, 'public')));

			app.use(errorhandler({
				log: function(err, str, req) {
					req.log.error({
						err: err,
					}, 'error');
				},
			}));

			httpServer = http.createServer(app);
			server = engine.attach(httpServer);

			server.on('connection', function(socket) {
				socket.isMaster = false;

				send(['characters', characters.map(function(character) {
					return character.toDesc();
				})]);

				send(['info', {
					server: config.irc.server,
					port: config.irc.port,
					channel: config.channel,
					maxBeers: MAX_BEERS,
					maxScore: MAX_SCORE,
					stepPeriod: config.stepPeriod,
					times: config.times,
				}]);

				Object.keys(players).forEach(function(playerName) {
					var player = players[playerName];
					send(['player', player]);
				});

				socket.on('data', function(message) {
					try {
						message = JSON.parse(message);
					} catch (err) {
						return logger.error({
							err: err,
							message: message,
						}, 'Failed to parse message');
					}
					
					logger.info({
						message: message,
					}, 'Message');
					var messageHandler = messageHandlers[message[0]];
					if (messageHandler)
						messageHandler(socket, message);
					else
						logger.warn({
							handler: message[0],
						}, 'Unknown message handler');
				});
			});

			return callback();
		},
	], function(err) {
		return callback(err, httpServer, app);
	});
};

if (require.main === module)
	module.exports(function(err, server, app) {
		if (err) throw err;

		return server.listen(config.listen, function() {
			logger.info({
				env: app.get('env'),
				listen: config.listen,
			}, 'Listening');
		});
	});
