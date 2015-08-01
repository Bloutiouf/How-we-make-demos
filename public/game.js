/** @const */ var TILE_SIZE = 64;
/** @const */ var USABLES = ['BEER', 'CODE', 'GRAPHICS', 'MUSIC'];

/**
 * @enum {number}
 */
var Direction = {
	DOWN: 0,
	LEFT: 1,
	RIGHT: 2,
	UP: 3,
};

/**
 * @enum {number}
 */
var Screen = {
	WELCOME: {
		next: 'IRC',
	},
	IRC: {
		previous: 'WELCOME',
		next: 'CHAR0',
		onEnter: function() {
			showMessage('Play on IRC now!', [
				'Server: ' + info.server,
				'Port: ' + info.port,
				'Channel: ' + info.channel,
				'Web client: http://' + info.server + '/'
			]);
		},
	},
	CHAR0: {
		previous: 'IRC',
		next: 'CHAR1',
		onNext: function() {
			characters[0].show();
		},
		onPrevious: function() {
			characters[0].hide();
		},
	},
	CHAR1: {
		previous: 'CHAR0',
		next: 'CHAR2',
		onNext: function() {
			characters[1].show();
		},
		onPrevious: function() {
			characters[1].hide();
		},
	},
	CHAR2: {
		previous: 'CHAR1',
		next: 'CHAR3',
		onNext: function() {
			characters[2].show();
		},
		onPrevious: function() {
			characters[2].hide();
		},
	},
	CHAR3: {
		previous: 'CHAR2',
		next: 'CONTROLS',
		onNext: function() {
			characters[3].show();
		},
		onPrevious: function() {
			characters[3].hide();
		},
	},
	CONTROLS: {
		previous: 'CHAR3',
		next: 'SCORE',
		onEnter: function() {
			showMessage('Controls', [
				'Character selection:',
				'say 1, 2, 3, or 4',
				'Action vote:',
				'say W, A, S, D, or X',
			]);
		},
	},
	SCORE: {
		previous: 'CONTROLS',
		next: 'BEGINNING',
		onEnter: function() {
			showMessage('Scoring: make a demo!', [
				characters[0].name + ' (1) has a bonus for ' + characters[0].bonusAction,
				characters[1].name + ' (1) has a bonus for ' + characters[1].bonusAction,
				characters[2].name + ' (1) has a bonus for ' + characters[2].bonusAction,
				characters[3].name + ' (4) has a smaller bonus for everything',
				'Extra points when you have voted for the selected action!'
			]);
		},
	},
	BEGINNING: {
		previous: 'SCORE',
		next: 'GAME',
		onEnter: function() {
			showMessage('Get ready!', [
				'The demoparty is about to begin...',
			]);
		},
	},
	GAME: {
		onNext: function() {
			send(['start']);
			sourceNode.start(0);

			endTime = Date.now() + info.times * info.stepPeriod;
			
			function updateTimes() {
				var timeLeft = endTime - Date.now();

				if (timeLeft <= 0) {
					clearInterval(intervalId);
					timesElement.textContent = '';
					return;
				}

				timesElement.textContent = Math.floor(timeLeft / 1000);
			}

			var intervalId = setInterval(updateTimes, 200);
			updateTimes();
		},
	},
	END: {
		onEnter: function() {
			setTimeout(function() {
				characters.forEach(function(character) {
					return character.hide();
				});
				backgroundElement.classList.add('end');
			}, info.stepPeriod);
		}
	}
};

/** @const */ var backgroundElement = document.getElementById('background');
/** @const */ var charactersElement = document.getElementById('characters');
/** @const */ var uiElement = document.getElementById('ui');
/** @const */ var timesElement = document.getElementById('times');
/** @const */ var messagesElement = document.getElementById('messages');

var characters;
var info;
var endTime;

var currentScreen = Screen.WELCOME;

function getRank(index) {
	if (index === 0)
		return '1st';
	if (index === 1)
		return '2nd';
	if (index === 2)
		return '3rd';
	return (index + 1) + 'th';	
}

/** @const */ var styleVendors = ['webkit', 'moz', 'ms', 'o'];
function setStyleVendor(element, property, value) {
	element.style[property] = value;
	property = property[0].toUpperCase() + property.substr(1);
	styleVendors.forEach(function(prefix) {
		element.style[prefix + property] = value;
	});
}

function showMessage(title, content) {
	var containerElement = document.createElement('div');
	containerElement.className = 'message-container';
	messagesElement.appendChild(containerElement);

	var element = document.createElement('div');
	element.className = 'message';
	containerElement.appendChild(element);

	var titleElement = document.createElement('div');
	titleElement.className = 'title';
	titleElement.textContent = title;
	element.appendChild(titleElement);

	if (content)
		content.forEach(function(line, index) {
			var lineElement = document.createElement('div');
			lineElement.textContent = line;
			setStyleVendor(lineElement, 'animationDelay', (index + 1) * 500 + 'ms');
			element.appendChild(lineElement);
		});
}

function removeMessages() {
	var messageElements = document.getElementsByClassName('message-container');
	Array.prototype.forEach.call(messageElements, function(messageElement){
	    messageElement.classList.add('disappear');
	    setTimeout(function() {
	    	messageElement.remove();
	    }, 1000);
	});
}

var sourceNode;
function loadAudioLoop() {
	var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

	var files = [
		'/loop.ogg',
		'/loop.mp3',
		'/loop.wav',
	];

	function load(fileIndex) {
		if (fileIndex >= files.length) return;

		var request = new XMLHttpRequest();
		request.open('GET', files[fileIndex], true);
		request.responseType = 'arraybuffer';

		request.onload = function() {
			if (request.status >= 400) {
				return load(fileIndex + 1);
			}
			
			audioCtx.decodeAudioData(request.response, function(buffer) {
				if (!buffer) {
					return console.error('Error while decoding');
				}
				
				var gainNode = audioCtx.createGain();
				sourceNode = audioCtx.createBufferSource();
				sourceNode.buffer = buffer;
				sourceNode.loop = true;
				sourceNode.connect(gainNode);
				gainNode.connect(audioCtx.destination);
			}, function() {
				console.error('Error while decoding');
				return load(fileIndex + 1);
			});
		};

		request.onerror = function(err) {
			console.error(err);
			return load(fileIndex + 1);
		};

		request.send();
	}

	return load(0);
}

function Character(index) {
	var self = this;

	this.index = index;
	this.name = '';
	this.x = 0;
	this.y = 0;
	this.direction = Direction.DOWN;
	this.actionDescs = [];

	this.shadowElement = document.createElement('div');
	this.shadowElement.className = 'char-shadow hidden';
	charactersElement.appendChild(this.shadowElement);

	this.characterElement = document.createElement('div');
	this.characterElement.className = 'char hidden';
	charactersElement.appendChild(this.characterElement);

	this.columnElement = document.createElement('div');
	this.columnElement.id = 'column' + index;
	this.columnElement.className = 'column hidden';
	uiElement.appendChild(this.columnElement);

	this.columnCharacterElement = document.createElement('div');
	this.columnCharacterElement.className = 'char';
	this.columnElement.appendChild(this.columnCharacterElement);

	this.columnNameElement = document.createElement('div');
	this.columnNameElement.className = 'name';
	this.columnElement.appendChild(this.columnNameElement);

	this.columnCountElement = document.createElement('div');
	this.columnCountElement.className = 'count';
	this.columnCountElement.textContent = '0 players';
	this.columnElement.appendChild(this.columnCountElement);

	this.columnBarElements = {};
	USABLES.forEach(function(usable) {
		var element = document.createElement('div');
		element.className = 'bar ' + usable.toLowerCase();
		self.columnElement.appendChild(element);
		self.columnBarElements[usable] = element;
	});

	if (index < 3) {
		this.columnArrowElement = document.createElement('div');
		this.columnArrowElement.className = 'arrow';
		this.columnElement.appendChild(this.columnArrowElement);
	}

	this.columnPlayersElement = document.createElement('div');
	this.columnPlayersElement.className = 'players';
	this.columnElement.appendChild(this.columnPlayersElement);

}

Character.prototype.show = function() {
	this.shadowElement.classList.remove('hidden');
	this.characterElement.classList.remove('hidden');
	this.columnElement.classList.remove('hidden');
};

Character.prototype.hide = function() {
	this.shadowElement.classList.add('hidden');
	this.characterElement.classList.add('hidden');
	this.columnElement.classList.add('hidden');
};

Character.prototype.part = function(name) {
	var self = this;
	
	this.actionDescs.forEach(function(actionDesc) {
		actionDesc.players = actionDesc.players.filter(function(actionPlayer) {
			return actionPlayer.name !== name;
		});
	});

	var y = 0;
	this.actionDescs.forEach(function(actionDesc) {
		if (!actionDesc.players.length) {
			actionDesc.element.classList.add('hidden');
		} else {
			actionDesc.element.classList.remove('hidden');
			setStyleVendor(actionDesc.element, 'transform', 'translate(0px, ' + y + 'px');
			y += 26;
			actionDesc.players.forEach(function(actionPlayer) {
				actionPlayer.setY(y);
				y += 22;
			});
		}
	});

	var count = 0;
	Object.keys(players).forEach(function(playerName) {
		if (players[playerName].character === self.index)
			++count;
	});
	this.columnCountElement.textContent = count + ' players';
};

Character.prototype.updateAnimations = function(step) {
	step = (step + this.index) % 4;
	step = (step === 3 ? 1 : step);
	var offsetX = - this.index * TILE_SIZE * 3 - step * TILE_SIZE;
	var offsetY = - this.direction * TILE_SIZE;
	var backgroundPosition = offsetX + 'px ' + offsetY + 'px';
	this.characterElement.style.backgroundPosition = backgroundPosition;
	this.columnCharacterElement.style.backgroundPosition = backgroundPosition;
};

Character.prototype.updateProfile = function(desc) {
	this.name = desc.name;
	this.bonusAction = desc.bonusAction;
	this.columnNameElement.textContent = desc.name;
};

Character.prototype.updateElements = function(desc) {
	var self = this;

	this.x = desc.x;
	this.y = desc.y;
	this.direction = desc.direction;
	var transform = 'translate(' + (this.x * TILE_SIZE) + 'px, ' + (this.y * TILE_SIZE) + 'px';
	setStyleVendor(this.shadowElement, 'transform', transform);
	setStyleVendor(this.characterElement, 'transform', transform);

	if (info)
		USABLES.forEach(function(usable) {
			var max = (usable === 'BEER' ? info.maxBeers : info.maxScore);
			self.columnBarElements[usable].style.width = (desc.scores[usable] * 168 / max) + 'px';
		});
};

Character.prototype.updatePlayer = function(playerDesc) {
	var self = this;
	
	var player = getPlayer(playerDesc.name);
	player.character = playerDesc.character;

	var actionDesc;

	this.actionDescs.forEach(function(actionDesc) {
		actionDesc.players = actionDesc.players.filter(function(actionPlayer) {
			return actionPlayer !== player;
		});
	});

	if (playerDesc.character === this.index) {
		if (playerDesc.action === 'IDLE') {
			player.setParentElement(null);
		} else {
			if (!this.actionDescs.some(function(actionDesc) {
				if (playerDesc.action === actionDesc.action) {
					actionDesc.players.unshift(player);
					return true;
				}
			})) {
				var element = document.createElement('div');
				element.className = 'title';
				element.textContent = playerDesc.action;
				this.columnPlayersElement.appendChild(element);

				this.actionDescs.push({
					action: playerDesc.action,
					element: element,
					players: [player],
				});
			}

			player.setParentElement(this.columnPlayersElement);
		}
	}

	var actionDescs = [];
	while (this.actionDescs.length) {
		var max = -1;
		var maxIndex = -1;
		for (var i = 0; i < this.actionDescs.length; ++i) {
			actionDesc = this.actionDescs[i];
			if (actionDesc.players.length > max) {
				max = actionDesc.players.length;
				maxIndex = i;
			}
		}
		
		actionDesc = this.actionDescs[maxIndex];
		this.actionDescs.splice(maxIndex, 1);
		actionDescs.push(actionDesc);
	}
	this.actionDescs = actionDescs;

	var y = 0;
	this.actionDescs.forEach(function(actionDesc) {
		if (!actionDesc.players.length) {
			actionDesc.element.classList.add('hidden');
		} else {
			actionDesc.element.classList.remove('hidden');
			setStyleVendor(actionDesc.element, 'transform', 'translate(0px, ' + y + 'px');
			y += 26;
			actionDesc.players.forEach(function(actionPlayer) {
				actionPlayer.setY(y);
				y += 22;
			});
		}
	});

	var count = 0;
	Object.keys(players).forEach(function(playerName) {
		if (players[playerName].character === self.index)
			++count;
	});
	this.columnCountElement.textContent = count + ' players';
};

function Player(name) {
	this.name = name;

	this.element = document.createElement('div');
	this.element.className = 'player';
	this.element.textContent = name;
}

Player.prototype.remove = function() {
	this.element.remove();
};

Player.prototype.setName = function(name) {
	this.name = name;
	this.element.textContent = name;
};

Player.prototype.setParentElement = function(parentElement) {
	if (parentElement)
		parentElement.appendChild(this.element);
	else
		this.element.remove();
};

Player.prototype.setY = function(y) {
	setStyleVendor(this.element, 'transform', 'translate(0px, ' + y + 'px');
};

var players = {};

function getPlayer(name) {
	var player = players[name];
	if (!player)
		player = players[name] = new Player(name);
	return player;
}

var socket;

function send(args) {
	return socket.send(JSON.stringify(args));
}

var messageHandlers = {
	characters: function(message) {
		var characterDescs = message[1];
		characters.forEach(function(character, characterIndex) {
			var desc = characterDescs[characterIndex];
			if (!desc) return;

			character.updateProfile(desc);
			character.updateElements(desc);
		});
	},
	end: function(message) {
		nextScreen('END');
	},
	info: function(message) {
		info = message[1];
	},
	nick: function(message) {
		var oldNick = message[1];
		var newNick = message[2];
		var player = players[oldNick];
		if (player) {
			delete players[oldNick];
			player.setName(newNick);
			players[newNick] = player;
		}
	},
	part: function(message) {
		var name = message[1];

		var player = players[name];
		if (player) {
			player.remove();
			delete players[name];
		}

		characters.forEach(function(character) {
			character.part(name);
		});
	},
	player: function(message) {
		var playerDesc = message[1];
		characters.forEach(function(character) {
			character.updatePlayer(playerDesc);
		});
	},
	step: function(message) {
		var times = message[1];
		var characterDescs = message[2];

		characters.forEach(function(character, characterIndex) {
			var desc = characterDescs[characterIndex];
			if (!desc) return;
			character.updateElements(desc);
		});

		endTime = Date.now() + times * info.stepPeriod;
	},
	winners: function(message) {
		var characterDescs = message[1];
		var playerDescs = message[2];

		showMessage('Winners', characterDescs.map(function(desc, index) {
			return getRank(index) + ': ' + desc.name	;
		}));

		setTimeout(function() {
			removeMessages();
			showMessage('Leaderboard', playerDescs.map(function(desc, index) {
				return getRank(index) + ': ' + desc.name	;
			}));
		}, 6000);
	},
};

function connect() {
	socket = new eio.Socket();

	socket.on('open', function() {
		if (location.hash)
			send(['auth', location.hash.substr(1)]);
	});
	
	socket.on('message', function(message) {
		try {
			message = JSON.parse(message);
		} catch (err) {
			console.warn(message);
			return console.error(err);
		}
		
		console.log(message);
		var messageHandler = messageHandlers[message[0]];
		if (messageHandler)
			messageHandler(message);
		else
			console.warn('Unknown', message[0]);
	});
	
	socket.on('close', function() {
		console.warn('Connection closed');
		connect();
	});
}

var animationStep = 0;
function updateAnimations() {
	characters.forEach(function(character) {
		return character.updateAnimations(animationStep);
	});

	var backgroundPosition = Math.floor(animationStep / 4) * 896 + 'px 0px';
	backgroundElement.style.backgroundPosition = backgroundPosition;

	animationStep = (animationStep + 1) % 8;
}

function nextScreen(screen) {
	currentScreen = Screen[screen];
	if (currentScreen.onNext)
		currentScreen.onNext();

	removeMessages();
	if (currentScreen.onEnter)
		currentScreen.onEnter();
}

function start() {
	characters = [
		new Character(0),
		new Character(1),
		new Character(2),
		new Character(3),
	];

	updateAnimations();
	setInterval(updateAnimations, 200);

	connect();
	
	loadAudioLoop();

	document.addEventListener('keydown', function(event) {
		console.log(event);
		switch (event.which) {
			case 37: // left
				event.preventDefault();
				if (currentScreen.previous) {
					if (currentScreen.onPrevious)
						currentScreen.onPrevious();
					currentScreen = Screen[currentScreen.previous];

					removeMessages();
					if (currentScreen.onEnter)
						currentScreen.onEnter();
				}
				break;

			case 39: // right
				event.preventDefault();
				if (currentScreen.next) {
					nextScreen(currentScreen.next);
				}
				break;
		}
	});
}
