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
							alert("Currently not supported");
							return;
							// if (!isUrlValid(url)) {
							// addAlert($("#startWorker"), "Invalid URL: "
							// + url);
							// return;
							// }
							//
							// var startResult = startRestWorker(url)
							// if (startResult == false) {
							// }
							// startResult.done(function() {
							// console.log("OK");
							// }).fail(
							// function(a, b, c) {
							// addAlert($("#startWorker"),
							// "Error while registering to master at: "
							// + url);
							// }).always(function() {
							//								console.log("FINISHED");
							//							})
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
		connection.send(workInitRequest());
		connection.worker.state = "connected";
		updateReport(connection.worker);
	};

	// Log messages from the server
	connection.onmessage = function(message) {
		var inputMessage = JSON.parse(message.data);
		if (inputMessage.type == "REGISTRATION_RESPONSE") {
			// Not needed in the case of sum
			connection.send(workInitRequest());
			connection.worker.state = "registration";
			updateReport(connection.worker);
		} else if (inputMessage.type == "WORK_INIT_RESPONSE") {
			if (!checkResponseType(inputMessage)) {
				connection.worker.state = "error";
				updateReport(connection.worker);
			} else {
				connection.worker.state = "init";
				updateReport(connection.worker);

				var data = inputMessage.task[1].data[1];

				var computationResult = computeResult(data);
				var resultMessage = workRequest(inputMessage, computationResult);
				connection.send(resultMessage);

				connection.worker.state = "running";
				updateReport(connection.worker);
				connection.worker.count++;
			}
		} else if (inputMessage.type == "WORK_RESPONSE") {
			var task = inputMessage.data;
			var computationResult = computeResult(task);
			var resultMessage = workRequest(message, computationResult);
			connection.send(resultMessage);

			connection.worker.count++;
			connection.worker.state = "running";
			if (connection.worker.count % 1000 == 0) {
				updateReport(connection.worker);
			}
		} else if (inputMessage.type == "SHUTDOWN") {
			console.log("Got SHUTDOWN");
			connection.worker.state = "finished";
			updateReport(connection.worker);
			connection.close();
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
		if (connection.worker.state == "running") {
			connection.worker.state = "finished";
		}
		updateReport(connection.worker);
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
		task : null
	}
	return JSON.stringify(message);
}

function workRequest(inputMessage, data) {
	var message = inputMessage;
	message.type = "WORK_REQUEST";
	message.task[1].data = data

	var result = JSON.stringify(message);

	return result;
}

function checkResponseType(response) {
	if (!$.isArray(response.task)) {
		console.log("Response is not in the right format, must have a task property, that is of type array");
		return false;
	}
	if (!response.task.length >= 2) {
		console.log("Response is not in the right format, task array must be of size >= 2");
		return false;
	}
	if (response.task[0] != "at.ac.uibk.dps.biohadoop.tasksystem.queue.ClassNameWrappedTask") {
		console.log("Response is not in the right format, task array's first entry must be the string \"at.ac.uibk.dps.biohadoop.tasksystem.queue.ClassNameWrappedTask\"");
		return false;
	}
	var taskWrapper = response.task[1];
	if (taskWrapper.className != "at.ac.uibk.dps.biohadoop.algorithms.sum.AsyncSumComputation") {
		console.log("Can not compute task of type "
						+ taskWrapper.className
						+ "; can only compute tasks of type \"at.ac.uibk.dps.biohadoop.algorithms.sum.AsyncSumComputation\"");
		return false;
	}
	return true;
}

function computeResult(data) {
	var sum = 0;
	for (var i = 0; i < data.length; i++) {
		sum += data[i];
	}
	return sum;
}

function updateReport(worker) {
	var tds = $("td", $("#worker-" + worker.id));

	// check if row exists
	if (tds.length == 0) {
		var newRow = $(""
				+ "<tr id='worker-" + worker.id + "'>"
				+ "<td>" + worker.id + "</td>"
				+ "<td>" + worker.url + "</td>"
				+ "<td>" + worker.type + "</td>"
				+ "<td>" + worker.state + "</td>"
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

	if (worker.state == "finished" || worker.state == "stopped"
			|| worker.state == "error" || worker.state == "fatal error") {
		$(tds[5]).text("");
	}
}