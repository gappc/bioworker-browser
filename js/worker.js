var workerCount = 0;
var workers = {};

$(function() {
	// add nav handler
	var navSidebar = $(".nav-sidebar");
	$("a", navSidebar).on("click", function(event, a, b, c) {
		var page = $(this).attr("href");
		if (page != null && page.length > 0) {
			var element = page.substr(1);
			$(".main").not(":hidden").hide();
			$("#" + element).show();

			$(".active", navSidebar).removeClass("active");
			$(this).parent().addClass("active");
		}
	});

	// add new worker
	$("#startWorker").on("click", function() {
		var url = $("#workerUrl").val();
		var type = $("#workerType").val()
		if (type === "rest") {
			alert("Currently not supported");
			return;
		} else if (type === "websocket") {
			if (!isUrlValid(url)) {
				addAlert($("#startWorker"), "Invalid URL: " + url);
				return;
			}
			startWebSocketWorker(url);
		} else {
			addAlert($("#startWorker"), "Worker type is not supported");
		}
	});
})

function addAlert(sibling, text) {
	var alert = $('<div class="alert alert-danger"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>'
			+ text + '</div>');
	alert.insertAfter(sibling);
}

function isUrlValid(url) {
	return (url != null && url.length > 0);
}

function startWebSocketWorker(url) {
	var connection = new WebSocket(url);

	workerCount++;
	workers["worker-" + workerCount] = connection;

	connection.worker = {
		id : workerCount,
		url : url,
		type : "WebSocket",
		state : "new",
		count : 0,
		initialData : {},
		oldTask : null
	}
	updateReport(connection.worker);

	connection.onopen = function() {
		connection.send(workRequest(null));
		connection.worker.state = "connected";
		updateReport(connection.worker);
	};

	// Log messages from the server
	connection.onmessage = function(message) {
		var inputMessage = JSON.parse(message.data);
		var task = inputMessage.task;
		var initialData = null;
		// Work response
		if (inputMessage.type == 1) {
			var taskTypeId = task.taskTypeId;
			var initialData = connection.worker.initialData[taskTypeId];
			if (initialData == null) {
				connection.worker.oldTask = task;
				connection.send(initialDataRequest(task));
				return;
			}
		} else if (inputMessage.type == 3) {
			var taskTypeId = inputMessage.task.taskTypeId;
			var task = inputMessage.task;
			var dataType = task.data[0];
			// TODO: Check for dataType
			var asyncClassName = task.data[1]["asyncComputableClassName"];
			initialData = task.data[1]["initialData"];
			connection.worker.initialData[taskTypeId] = initialData;
			task = connection.worker.oldTask;
		}
		task.data = computeResult(task.data, initialData);
		connection.send(workRequest(task));
		connection.worker.count++;
		connection.worker.state = "running";
		updateReport(connection.worker);
	};

	// Log errors
	connection.onerror = function(error) {
		if (connection.worker.state == "new") {
			addAlert($("#startWorker"), "Websocket could not connect to "
					+ connection.worker.url);
			connection.worker.state = "error";
			updateReport(connection.worker);
		} else {
			connection.worker.state = "fatal error";
			updateReport(connection.worker);
		}
	};

	connection.onclose = function(session) {
		if (connection.worker.state == "running") {
			connection.worker.state = "finished";
		}
		updateReport(connection.worker);
	}
}

function workRequest(task) {
	var message = {
		type : 0,
		task : task
	};
	var result = JSON.stringify(message);
	return result;
}

function initialDataRequest(task) {
	var message = {
		type : 2,
		task : task
	};
	var result = JSON.stringify(message);
	return result;
}

function computeResult(data, initialData) {
	var start = new Date().getTime();
	var matrixA = initialData[1]["matrixA"];
	var matrixB = initialData[1]["matrixB"];
	var size = matrixA.length;
	var matrixC = new Array(size);
	for (var i = 0; i < size; i++) {
		matrixC[i] = new Array(size);
		for (var j = 0; j < size; j++) {
			matrixC[i][j] = 0;
		}
	}
	var blocks = data[1];
	for (var iOuter = 0; iOuter < size; iOuter += blocks[0]) {
		for (var jOuter = 0; jOuter < size; jOuter += blocks[1]) {
			for (var kOuter = 0; kOuter < size; kOuter += blocks[0]) {
				for (var i = iOuter; i < Math.min(iOuter + blocks[0], size); i++) {
					for (var j = jOuter; j < Math.min(jOuter + blocks[1], size); j++) {
						for (var k = kOuter; k < Math.min(kOuter + blocks[0],
								size); k++) {
							matrixC[i][j] += matrixA[i][k] * matrixB[j][k];
						}
					}
				}
			}
		}
	}
	var end = new Date().getTime();
	var timeTaken = (end - start) * 1000000;
	return [ "java.lang.Long", timeTaken ];
}

function updateReport(worker) {
	var tds = $("td", $("#worker-" + worker.id));

	// check if row exists
	if (tds.length == 0) {
		var newRow = $(""
				+ "<tr id='worker-"
				+ worker.id
				+ "'>"
				+ "<td>"
				+ worker.id
				+ "</td>"
				+ "<td>"
				+ worker.url
				+ "</td>"
				+ "<td>"
				+ worker.type
				+ "</td>"
				+ "<td>"
				+ worker.state
				+ "</td>"
				+ "<td>"
				+ worker.count
				+ "</td>"
				+ "<td><span class='glyphicon glyphicon-remove' style='cursor:pointer'></span></td>"
				+ "</tr>");
		$("#reports #running tbody").append(newRow);
		$(".glyphicon-remove", newRow).on(
				"click",
				function(element) {
					var workerId = $(element.currentTarget).parent().parent()
							.attr("id");
					var connection = workers[workerId];
					connection.close();
					connection.worker.state = "stopped";
					updateReport(connection.worker);
				});

		tds = $("td", $("#worker-" + worker.id));
	}

	$(tds[3]).text(worker.state);
	$(tds[4]).text(worker.count);

	if (worker.state == "finished" || worker.state == "stopped"
			|| worker.state == "error" || worker.state == "fatal error") {
		$(tds[5]).text("");
	}
}