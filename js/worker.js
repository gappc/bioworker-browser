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
	$("#startWorker").on(
			"click",
			function() {
				var url = $("#workerUrl").val();
				var type = $("#workerType").val()
				if (type === "rest") {
					if (!isUrlValid(url)) {
						addAlert($("#startWorker"), "Invalid URL: " + url);
						return;
					}

					var startResult = startRestWorker(url)
					if (startResult == false) {
					}
					startResult.done(function() {
						console.log("OK");
					}).fail(function(a, b, c) {
						addAlert($("#startWorker"), "Error while registering to master at: " + url);
					}).always(function() {
						console.log("FINISHED");
					})
				} else if (type === "websocket") {
					addAlert($("#workers .sub-header"), "Error");
				} else {
					addAlert($("#workers .sub-header"),
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
	var data = getRegistrationMessage();
//	var callback = $.post(url, data);
	
	var callback = $.ajax({
		type: "POST",
		url: url,
		data: getRegistrationMessage(),
		dataType: "json",
		origin: "FUCK",
		crossDomain: true
	});
	
	return callback;
}

function startWebSocketWorker(url) {
	if (url == null || url.length == 0) {
		return "Invalid URL: " + url;
	}
}

function getRegistrationMessage() {
	var message = {
		type : "REGISTRATION_REQUEST",
		data : null
	}
	return message;
}