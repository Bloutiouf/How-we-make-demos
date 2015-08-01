# How we make demos

> Interactive entry at the evoke 2015

This game illustrates how we make demos in the group tmp, although I think many demosceners do the same, that is, underestimate the time it takes to make it, and rush it during the party to reach the deadline.

## Gameplay

The goal is to make a demo in two minutes. In order to make it, one has to program code, draw graphics, and compose music. And obviously, to be able to do so, you need some beers.

Players connect to an IRC server and sends messages to interact with the game.

They can choose between four characters to control, actual members of the tmp demogroup:

1. wsmind
2. Nical
3. ev0
4. Gruck

by sending the message `1`, `2`, `3`, or `4` accordingly. The players can freely change their character until the game starts.

After that, they can vote for the action to be executed next. Every 1.5 seconds during the game, the characters will execute the action that receive the most votes. Players can therefore for an action by sending:

- `W`: go up
- `A`: go left
- `S`: go down
- `D`: go right
- `X`: contextual action

There are three tables in the demoparty: one to program, one to draw, and one to compose music. When a character is next to one of these tables, he can do the related action: code, draw, or compose. There is also a bar, the contextual action is here to drink a beer.

By programming, drawing, or composing, characters earn points in the corresponding domain. The sum gives the character's final score. Scores on each domain are capped, in order to encourage to score on all domains.

Note that every time a character programs, draws, or composes, he gets more sober and looses the equivalent of one beer. He cannot do any work if he doesn't have at least a beer in blood. Characters cannot have more than four beers in blood.

Players earn 1 point, in addition to their character score, every time they have voted for the action which is executed. This leads to a in-game leaderboard for the four characters, and a meta-game leaderboard for the players. 

## Technical details

In order to retrieve the IRC messages, the game connects to the IRC server as a bot. I recommend to use a dedicated IRC server in order to avoid getting ban for spamming; I used [inspircd](https://github.com/inspircd/inspircd). I also installed a web client in case some players don't have an IRC client; I used [Kiwi](https://github.com/prawnsalad/KiwiIRC).  

Things to take care of:

1. Flood protection to disable
2. If you have a web client, disable the limit of clients per IP

The app is designed to have only one output screen, which displays a web page. It is accessible trough `http://ip:port/#masterPassword`, where the masterPassword serves for the authentication. The master controls the game screens with the keys `left` and `right`.

Tested on Chrome and Firefox. Designed to be played fullscreen on resolution 1920x1080.

### Installation

You need [node.js](https://nodejs.org/).

	git clone https://github.com/Bloutiouf/How-we-make-demos.git
	cd How-we-make-demos
	npm install
	node .

## Design details

The game has not been balanced at all, so if all player always play the best actions, some characters have an unfair advantage. It is expected that players won't always play at best, so this advantage is not noticeable.

The music is 80 BPM, therefore two musical steps are exactly 1.5 seconds, the period of the players' action execution. I believe this helps the players to synchronize their votes on an unconscious level.

Scores on code, graphics, and music, are capped, but 2 minutes are not enough to reach the limit in all domains.

## Credits

Concept, code, some graphics: Bloutiouf / tmp

Additional graphics: ponk + CoyHot / X-Men

Music: DJ Pie

[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
