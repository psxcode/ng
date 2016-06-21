//visitor is synchronous
//function(elem, index, array)

function visitArraySequentialSync(arr, visitor) {
	for (var i = 0; i < arr.length; ++i) {
		visitor(arr[i], i, arr);
	}
}

function mapArraySequentialSync(arr, visitor) {
	var result = new Array(arr.length);
	for (var i = 0; i < arr.length; ++i) {
		result[i] = visitor(arr[i], i, arr);
	}
	return result;
}

//visitor is asynchronous
//function(elem, index, array, done)

function visitArraySequentialAsync(arr, visitor, done) {

	visitArrayNext(0);

	function visitArrayNext(index) {
		if (index < arr.length) {
			visitor(arr[index], index, arr, function () {
				visitArrayNext(index + 1);
			});
		} else {
			done();
		}
	}
}

//visitor is asynchronous
//function(elem, index, array, done)

function mapArraySequentialAsync(arr, visitor, done) {
	var result = new Array(arr.length);

	visitArrayNext(0);

	function visitArrayNext(index) {
		if (index < arr.length) {
			visitor(arr[index], index, arr, function (res) {
				result[index] = res;
				visitArrayNext(index + 1);
			});
		} else {
			done(result);
		}
	}
}

function mapArrayParallelAsync(arr, visitor, done) {
	var result = new Array(arr.length);
	var iterationsComplete = 0;

	if(iterationsComplete === result.length) {
		done(result);
	}

	for (var i = 0; i < arr.length; ++i) {
		visitArrayNext(i);
	}

	function visitArrayNext(index) {
		visitor(arr[index], index, arr, function (res) {
			result[index] = res;
			// === prevents multiple 'done' call
			if(++iterationsComplete === result.length) {
				done(result);
			}
		});
	}
}

