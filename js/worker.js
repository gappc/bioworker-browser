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
	$("#startWorker")
			.on(
					"click",
					function() {
						var url = $("#workerUrl").val();
						var type = $("#workerType").val()
						if (type === "rest") {
							if (!isUrlValid(url)) {
								addAlert($("#startWorker"), "Invalid URL: "
										+ url);
								return;
							}

							var startResult = startRestWorker(url)
							if (startResult == false) {
							}
							startResult.done(function() {
								console.log("OK");
							}).fail(
									function(a, b, c) {
										addAlert($("#startWorker"),
												"Error while registering to master at: "
														+ url);
									}).always(function() {
								console.log("FINISHED");
							})
						} else if (type === "websocket") {
							if (!isUrlValid(url)) {
								addAlert($("#startWorker"), "Invalid URL: "
										+ url);
								return;
							}
							startWebSocketWorker(url);
						} else {
							addAlert($("#startWorker"),
									"Worker type is not supported");
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

function startRestWorker(url) {
	var data = registrationRequest();
	// var callback = $.post(url, data);

	var callback = $.ajax({
		type : "POST",
		url : url,
		data : registrationRequest(),
		dataType : "json",
		origin : "FUCK",
		crossDomain : true
	});

	return callback;
}

function startWebSocketWorker(url) {
	var connection = new WebSocket(url);
	console.log(connection);

	workerCount++;
	workers["worker-" + workerCount] = connection;

	connection.worker = {
		id : workerCount,
		url : url,
		type : "WebSocket",
		state : "new",
		count : 0
	}
	updateReport(connection.worker);

	connection.onopen = function() {
		connection.send(registrationRequest());
		connection.worker.state = "connected";
		updateReport(connection.worker);
	};

	// Log messages from the server
	connection.onmessage = function(message) {
		var response = JSON.parse(message.data);
		if (response.type == "REGISTRATION_RESPONSE") {
			connection.send(workInitRequest());
			connection.worker.state = "registration";
			updateReport(connection.worker);
		} else if (response.type == "WORK_INIT_RESPONSE") {
			connection.worker.state = "init";
			updateReport(connection.worker);

			distances = response.data[0];
			var task = response.data[1];

			var computation = computeResult(task);
			var resultMessage = workRequest(message, task, computation);
			connection.send(resultMessage);

			connection.worker.state = "running";
			updateReport(connection.worker);
			connection.worker.count++;
		} else if (response.type == "WORK_RESPONSE") {
			var task = response.data;
			var computation = computeResult(task);
			var resultMessage = workRequest(message, task, computation);
			connection.send(resultMessage);

			connection.worker.count++;
			connection.worker.state = "running";
			if (connection.worker.count % 1000 == 0) {
				updateReport(connection.worker);
			}
		} else if (response.type == "SHUTDOWN") {
			console.log("Got SHUTDOWN");
			connection.worker.state = "finished";
			updateReport(connection.worker);
		}
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
	}
}

function registrationRequest() {
	var message = {
		type : "REGISTRATION_REQUEST",
		data : null
	}
	return JSON.stringify(message);
}

function workInitRequest() {
	var message = {
		type : "WORK_INIT_REQUEST",
		data : null
	}
	return JSON.stringify(message);
}

function workRequest(input, task, data) {
	var message = {
		type : "WORK_REQUEST",
		data : {
			id : task.id,
			slot : task.slot,
			result : data
		}
	}
	var result = JSON.stringify(message);

	var idPos = input.data.search("\"id\"");
	var idStart = input.data.indexOf(":", idPos) + 1;
	var idEnd = input.data.indexOf(",", idStart);
	var id = input.data.substr(idStart, idEnd - idStart);

	return result.replace(task.id, id);
}

function computeResult(task) {
	return computeFitness(task.genome);
}

function computeFitness(data) {
	var pathLength = 0.0;

	for (var i = 0; i < data.length - 1; i++) {
		pathLength += distances[data[i]][data[i + 1]];
	}

	pathLength += distances[data[data.length - 1]][data[0]];

	return pathLength;
}

function updateReport(worker) {
	var tds = $("td", $("#worker-" + worker.id));

	// check if row exists
	if (tds.length == 0) {
		var newRow = $("" + "<tr id='worker-" + worker.id + "'>" + "<td>"
				+ worker.id + "</td>" + "<td>" + worker.url + "</td>" + "<td>"
				+ worker.type + "</td>" + "<td>" + worker.state + "</td>"
				+ "<td>" + worker.count + "</td>"
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

	if (worker.state == "finished" || worker.state == "stopped" || worker.state == "error"
			|| worker.state == "fatal error") {
		$(tds[5]).text("");
	}
}