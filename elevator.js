/*
 * elevator.js: working code for elevator saga
 */

/*
 * Elevator:
 *     Methods
 *        void goToFloor(int floor[, bool immediately])
 *        void stop()
 *        int  currentFloor()
 *        bool goingUpIndicator([bool newValue])
 *        bool goingDownIndicator([bool newValue])
 *        number loadFactor()
 *        void checkDestinationQueue();
 *        int[] getPressedFloors()
 *
 *    Properties
 *        int[] destinationQueue;
 *
 *    Events
 *        'idle'
 *        'floor_button_pressed', int floorNum
 *        'passing_floor', int floorNum, string direction
 *        'stopped_at_floor'
 *
 * Floor:
 *     Properties
 *         int floorNum
 *
 *     Events
 *         'up_button_pressed'
 *         'down_button_pressed'
 */
doInit = function (elevators, floors) {
	var nextStopUpFrom, nextStopDownFrom;
	var reschedElevator, pickElevator;
	var assert;

	/* "ee" and "ff" are deliberately globals for debugging. */
	/* jsl:declare ee */
	/* jsl:declare ff */

	ee = elevators.map(function (e) {
		return ({
		    'direction': 'up',
		    'nextDirection': null,
		    'lastFloor': e.currentFloor(),
		    'nextStop': null
		});
	});

	ff = floors.map(function () {
		return ({
		    'up_pressed': false,
		    'up_claimed': null,
		    'down_pressed': false,
		    'down_claimed': null
		});
	});

	assert = function (cond) {
		if (!cond)
			throw (new Error('busted!'));
	};

	nextStopUpFrom = function (ei, fi, anydirokay) {
		var mincall, pressedabove;
		var i, dir;

		pressedabove = elevators[ei].getPressedFloors().filter(
		    function (pfi) { return (pfi >= fi); }).sort();

		for (i = fi; i < ff.length; i++) {
			if (ff[i].up_pressed &&
			    (ff[i].up_claimed === null ||
			    ff[i].up_claimed == ei)) {
				dir = 'up';
				break;
			}

			if (anydirokay && ff[i].down_pressed &&
			    (ff[i].down_claimed === null ||
			    ff[i].down_claimed == ei)) {
				dir = 'down';
				break;
			}
		}

		mincall = i;

		if (mincall == ff.length && pressedabove.length === 0)
			return (null);

		if (pressedabove.length === 0) {
			return ({
			    'floor': mincall,
			    'dir': dir
			});
		}

		if (mincall == ff.length || pressedabove[0] < mincall)
			return ({ 'floor': pressedabove[0], 'dir': 'any' });

		return ({ 'floor': mincall, 'dir': dir });
	};

	nextStopDownFrom = function (ei, fi, anydirokay) {
		var maxcall, pressedbelow;
		var i, dir;

		pressedbelow = elevators[ei].getPressedFloors().filter(
		    function (pfi) { return (pfi <= fi); }).sort().reverse();

		for (i = fi; i >= 0; i--) {
			if (ff[i].down_pressed &&
			    (ff[i].down_claimed === null ||
			    ff[i].down_claimed == ei)) {
				dir = 'down';
				break;
			}

			if (anydirokay && ff[i].up_pressed &&
			    (ff[i].up_claimed === null ||
			    ff[i].up_claimed == ei)) {
				dir = 'up';
				break;
			}
		}

		maxcall = i;

		if (maxcall == -1 && pressedbelow.length === 0)
			return (null);

		if (pressedbelow.length === 0)
			return ({ 'floor': maxcall, 'dir': dir });

		if (maxcall == -1 || pressedbelow[0] > maxcall)
			return ({ 'floor': pressedbelow[0], 'dir': 'any' });

		return ({ 'floor': maxcall, 'dir': dir });
	};

	reschedElevator = function (e, ei) {
		var estate, prefs, stop, curstatus;

		estate = ee[ei].direction;

		if (estate == 'up') {
			/*
			 * If the elevator is traveling up, then our next stop
			 * is one of the following, in preference order:
			 *
			 *     o If there's a call or button press above us
			 *       going up, take the closest such one.
			 *
			 *     o If there's a call or button press above us,
			 *       take the closest one.
			 *
			 *     o If there's a call or button press going down,
			 *       take the closest one.
			 *
			 *     o If there's any stop in either direction (call
			 *       or button press below us going up), take it.
			 */
			prefs = [
			    /* calls and button presses above, going up */
			    nextStopUpFrom(
			        ei, ee[ei].lastFloor + 1, false, false),

			    /* other calls and button presses above us */
			    nextStopUpFrom(
			        ei, ee[ei].lastFloor + 1, true, false),

			    /* calls or button presses below us, going down */
			    nextStopDownFrom(
			        ei, ee[ei].lastFloor, false, false),

			    /* other calls or button presses below us */
			    nextStopDownFrom(ei, ee[ei].lastFloor, true, false)
			];
		} else {
			/*
			 * The "down" case is a mirror of the "up" case.
			 */
			prefs = [
			    /* calls and button presses, going down */
			    nextStopDownFrom(
			        ei, ee[ei].lastFloor - 1, false, false),

			    /* other calls and button presses below us */
			    nextStopDownFrom(
			        ei, ee[ei].lastFloor - 1, true, false),

			    /* calls or button presses above us, going up */
			    nextStopUpFrom(ei, ee[ei].lastFloor, false, false),

			    /* other calls or button presses above us */
			    nextStopUpFrom(ei, ee[ei].lastFloor, true, false)
			];
		}

		prefs = prefs.filter(function (p) { return (p !== null); });
		curstatus = 'elev ' + ei + ', cur floor ' + e.currentFloor() +
		    ', last floor ' + ee[ei].lastFloor + ' (' + estate + ')';
		console.log('dap: ' + curstatus + ': options = ', prefs);
		if (prefs.length === 0) {
			console.log('dap: ' + curstatus +
			    ': nothing to do (now stopped)');
			ee[ei].nextDirection = null;
			return;
		}

		stop = ee[ei].nextStop = prefs[0];

		if (prefs[0].floor < ee[ei].lastFloor) {
			console.log('dap: ' + curstatus +
			    ': moving down to ' + stop.floor +
			    (ee[ei].direction == 'up' ?
			    ' (direction change) ' : ''));

			if (stop.dir != 'any') {
				ee[ei].nextDirection = stop.dir;
				console.error(ei, stop, ff[stop.floor]);
				if (stop.dir == 'up') {
					assert(ff[stop.floor].up_claimed ===
					    null || ff[stop.floor].up_claimed
					    === ei);
					ff[stop.floor].up_claimed = ei;
				} else {
					assert(ff[stop.floor].down_claimed ===
					    null ||
					    ff[stop.floor].down_claimed === ei);
					ff[stop.floor].down_claimed = ei;
				}
			}

			e.goToFloor(stop.floor, true);
			e.goingUpIndicator(false);
			e.goingDownIndicator(true);
			ee[ei].direction = 'down';
		} else if (prefs[0].floor > ee[ei].lastFloor) {
			console.log('dap: ' + curstatus +
			    ': moving up to ' + stop.floor +
			    (ee[ei].direction == 'down' ?
			    ' (direction change) ' : ''));

			if (stop.dir != 'any') {
				ee[ei].nextDirection = stop.dir;
				console.error(ei, stop, ff[stop.floor]);
				if (stop.dir == 'up') {
					assert(ff[stop.floor].up_claimed ===
					    null || ff[stop.floor].up_claimed
					    === ei);
					ff[stop.floor].up_claimed = ei;
				} else {
					assert(ff[stop.floor].down_claimed ===
					    null ||
					    ff[stop.floor].down_claimed === ei);
					ff[stop.floor].down_claimed = ei;
				}
			}

			e.goToFloor(stop.floor, true);
			e.goingUpIndicator(true);
			e.goingDownIndicator(false);
			ee[ei].direction = 'up';
		} else {
			console.log('dap: ' + curstatus +
			    ': reopening at floor ' + ee[ei].lastFloor);

			if (stop.dir != 'any')
				ee[ei].nextDirection = stop.dir;

			e.goToFloor(stop.floor, true);
		}
	};

	elevators.forEach(function (e, ei) {
		e.goingUpIndicator(true);
		e.goingDownIndicator(false);

		e.on('floor_button_pressed', function (fi) {
			console.log('dap: elev ' + ei + ': button pressed ' +
			    'for floor ' + fi);
			reschedElevator(e, ei);
		});

		e.on('passing_floor', function (fi) {
			ee[ei].lastFloor = fi;
		});

		e.on('stopped_at_floor', function (fi) {
			ee[ei].lastFloor = fi;
			console.log('dap: elev ' + ei +
			    ' stopped at floor ' + fi);

			if (ee[ei].nextDirection !== null &&
			    ee[ei].nextDirection != ee[ei].direction) {
				ee[ei].direction = ee[ei].nextDirection;
				ee[ei].nextDirection = null;
				e.goingUpIndicator(ee[ei].direction == 'up');
				e.goingDownIndicator(ee[ei].direction != 'up');
			}

			if (ee[ei].nextDirection !== null)
				ee[ei].nextDirection = null;

			reschedElevator(e, ei);

			if (ee[ei].direction == 'up' && ff[fi].up_pressed &&
			    ff[fi].up_claimed === ei) {
				ff[fi].up_pressed = false;
				ff[fi].up_claimed = null;
			} else if (ee[ei].direction == 'down' &&
			    ff[fi].down_pressed &&
			    ff[fi].down_claimed === ei) {
				ff[fi].down_pressed = false;
				ff[fi].down_claimed = null;
			}
		});

		e.on('idle', function () {
			reschedElevator(e, ei);
		});
	});

	pickElevator = function (fi, dir) {
		/*
		 * Try to find an elevator for which this wouldn't be out of the
		 * way.
		 */
		var ei;

		for (ei = 0; ei < ee.length; ei++) {
			if (ee[ei].direction == dir &&
			    dir == 'up' ? ee[ei].lastFloor < fi :
			    ee[ei].lastFloor > fi)
				return (ei);
		}

		return (Math.floor(Math.random() * ee.length));
	};

	floors.forEach(function (floor, fi) {
		floor.on('up_button_pressed', function () {
			var ei;
			ff[fi].up_pressed = true;
			console.log('dap: up requested at floor ' + fi);
			ei = pickElevator(fi, 'up');
			reschedElevator(elevators[ei], ei);
		});

		floor.on('down_button_pressed', function () {
			var ei;
			ff[fi].down_pressed = true;
			console.log('dap: down requested at floor ' + fi);
			ei = pickElevator(fi, 'down');
			reschedElevator(elevators[ei], ei);
		});
	});
},
doUpdate = function (dt, elevators, floors) {},
{
	'init': doInit,
	'update': doUpdate
}
