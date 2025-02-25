const cp = require("child_process");
const os = require("os");
let ffmpeg;
if (os.platform() === "win32") {
	ffmpeg = `"${__dirname}\\..\\ffmpeg.exe"`;
} else {
	ffmpeg = `"${__dirname}/../ffmpeg"`;
}

const fs = require("fs");

const path = require("path");
const { shell, ipcRenderer, clipboard } = require("electron");
const { default: YTDlpWrap } = require("yt-dlp-wrap-extended");

// Directories
const homedir = os.homedir();
const appdir = path.join(homedir, "Downloads");
const hiddenDir = path.join(homedir, ".ytDownloader");
const i18n = new (require("../translations/i18n"))();

fs.mkdir(hiddenDir, { recursive: true }, () => {});

// Download directory
let downloadDir = "";

// Global variables
let title, onlyvideo, id, thumbnail, ytdlp, duration, extractFormat;
let rangeCmd = "";
let subs = ""
let subLangs;
// let autoSubs = ""
let rangeOption = "--download-sections";

function getId(id) {
	return document.getElementById(id);
}

function downloadPathSelection() {
	let localPath = localStorage.getItem("downloadPath");

	if (localPath) {
		downloadDir = localPath;
	} else {
		downloadDir = appdir;
		localStorage.setItem("downloadPath", appdir);
	}
	fs.mkdir(downloadDir, { recursive: true }, () => {});
}

downloadPathSelection();

// Checking for yt-dlp
let ytDlp;
let ytdlpPath = path.join(os.homedir(), ".ytDownloader", "ytdlp");

// ytdlp download path
let ytdlpDownloadPath;
if (os.platform() == "win32") {
	ytdlpDownloadPath = path.join(os.homedir(), ".ytDownloader", "ytdlp.exe");
} else {
	ytdlpDownloadPath = path.join(os.homedir(), ".ytDownloader", "ytdlp");
}

// Downloading yt-dlp
async function downloadYtdlp() {
	document.querySelector("#popupBox p").textContent = i18n.__(
		"Please wait, necessary files are being downloaded"
	);
	getId("popupSvg").style.display = "inline";

	// Downloading appropriate version of yt-dlp
	if (os.platform() == "linux") {
		// Checking python version
		try {
			const result = cp.execSync("python3 --version", {
				encoding: "utf-8",
			});
			const minorVersion = Number(result.split(" ")[1].split(".")[1]);
			if (minorVersion >= 7) {
				await YTDlpWrap.downloadFromGithub(ytdlpDownloadPath);
			} else {
				// Downloading full binary if python version is less than 3.7
				await YTDlpWrap.downloadFromGithub(
					ytdlpDownloadPath,
					"",
					"linux",
					true
				);
			}
		} catch (error) {
			// Downloading full binary of python3 is not there
			await YTDlpWrap.downloadFromGithub(
				ytdlpDownloadPath,
				"",
				"linux",
				true
			);
		}
	} else {
		// In case of windows
		await YTDlpWrap.downloadFromGithub(ytdlpDownloadPath);
	}

	getId("popupBox").style.display = "none";
	ytDlp = ytdlpPath;
	ytdlp = new YTDlpWrap(ytDlp);
	getId("pasteUrl").style.display = "inline-block";
	console.log("yt-dlp bin Path: " + ytDlp);
}

// Checking if yt-dlp has been installed by user
cp.exec("yt-dlp --version", (error, stdout, stderr) => {
	if (error) {
		// Checking if yt-dlp has been installed by program
		cp.exec(`${ytdlpPath} --version`, (error, stdout, stderr) => {
			if (error) {
				getId("popupBox").style.display = "block";
				process.on("uncaughtException", (reason, promise) => {
					document.querySelector("#popupBox p").textContent = i18n.__(
						"Failed to download necessary files. Please check your network and try again"
					);
					getId("popupSvg").style.display = "none";
					getId("popup").innerHTML += `<button id="tryBtn">${i18n.__(
						"Try again"
					)}</button>`;
					console.log("Failed to download yt-dlp");

					getId("tryBtn").addEventListener("click", () => {
						getId("popup").removeChild(getId("popup").lastChild);
						downloadYtdlp();
					});
				});

				downloadYtdlp();
			} else {
				console.log("yt-dlp binary is present in PATH");
				ytDlp = ytdlpPath;
				ytdlp = new YTDlpWrap(ytDlp);
				cp.spawn(`${ytDlp}`, ["-U"]).stdout.on("data", (data) =>
					console.log(data.toString("utf8"))
				);
				getId("pasteUrl").style.display = "inline-block";
				console.log("yt-dlp bin Path: " + ytDlp);
			}
		});
	} else {
		console.log("yt-dlp binary is present in PATH");
		ytDlp = "yt-dlp";
		ytdlp = new YTDlpWrap(ytDlp);
		getId("pasteUrl").style.display = "inline-block";
		console.log("yt-dlp bin Path: " + ytDlp);
	}
});

function defaultVideoToggle() {
	videoToggle.style.backgroundColor = "var(--box-toggleOn)";
	audioToggle.style.backgroundColor = "var(--box-toggle)";
	getId("audioList").style.display = "none";
	getId("videoList").style.display = "block";
}

// Pasting url from clipboard

function pasteUrl() {
	defaultVideoToggle();
	getId("hidden").style.display = "none";
	getId("loadingWrapper").style.display = "flex";
	getId("incorrectMsg").textContent = "";
	const url = clipboard.readText();
	getInfo(url);
}

getId("closeHidden").addEventListener("click", () => {
	getId("hidden").style.display = "none";
	getId("loadingWrapper").style.display = "none";
});

document.addEventListener("keydown", (event) => {
	if (event.ctrlKey && event.key == "v") {
		pasteUrl();
	}
});

getId("pasteUrl").addEventListener("click", () => {
	pasteUrl();
});

// Getting video info
async function getInfo(url) {
	let audioIsPresent = false;
	downloadPathSelection();
	getId("videoFormatSelect").innerHTML = "";
	getId("audioFormatSelect").innerHTML = "";
	getId("startTime").value = "";
	getId("endTime").value = "";

	let info;
	cp.exec(`${ytDlp} -j ${url}`, (error, stdout, stderr) => {
		try {
			info = JSON.parse(stdout);
		} catch (error) {
			info = false;
			console.log(error);
		}

		console.log(info);

		if (info) {
			title = info.title;
			id = info.id;
			thumbnail = info.thumbnail;
			duration = info.duration;
			const formats = info.formats;
			console.log(formats);

			const urlElements = document.querySelectorAll(".url");

			urlElements.forEach((element) => {
				element.value = url;
			});

			getId("loadingWrapper").style.display = "none";
			getId("hidden").style.display = "inline-block";
			getId("title").innerHTML = `<b>${i18n.__("Title ")}</b>: ` + title;
			getId("videoList").style.display = "block";
			videoToggle.style.backgroundColor = "rgb(67, 212, 164)";

			let audioSize = 0;

			// Getting approx size of audio file and checking if audio is present
			for (let format of formats) {
				if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext === "none")
				) {
					audioIsPresent = true;
					onlyvideo = true;
					audioSize =
						Number(format.filesize || format.filesize_approx) /
						1000000;
				}
			}

			for (let format of formats) {
				let size;
				if (format.filesize || format.filesize_approx) {
					size = (
						Number(format.filesize || format.filesize_approx) /
						1000000
					).toFixed(2);
				} else {
					size = i18n.__("Unknown size");
				}

				// For videos
				if (
					format.video_ext !== "none" &&
					format.audio_ext === "none"
				) {
					if (size !== "Unknown size") {
						size = (Number(size) + 0 || Number(audioSize)).toFixed(
							2
						);
						size = size + " " + i18n.__("MB");
					}

					const format_id = format.format_id + "|" + format.ext;

					const element =
						"<option value='" +
						format_id +
						"'>" +
						(i18n.__(format.format_note) ||
							format.resolution ||
							"Unknown quality") +
						"  |  " +
						format.ext +
						"  |  " +
						size +
						"</option>";
					getId("videoFormatSelect").innerHTML += element;
				}

				// For audios
				else if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext === "none")
				) {
					size = size + " MB";
					let audio_ext;

					if (format.audio_ext === "webm") {
						audio_ext = "opus";
					} else {
						audio_ext = format.audio_ext;
					}

					const format_id = format.format_id + "|" + audio_ext;

					const element =
						"<option value='" +
						format_id +
						"'>" +
						i18n.__("Quality") +
						": " +
						(i18n.__(format.format_note) || i18n.__("Unknown quality")) +
						" | " +
						audio_ext +
						" | " +
						size +
						"</option>";
					getId("audioFormatSelect").innerHTML += element;
				}
				// Both audio and video available
				else if (
					format.audio_ext !== "none" ||
					(format.acodec !== "none" && format.video_ext !== "none")
				) {
					let size;
					if (format.filesize || format.filesize_approx) {
						size = (
							Number(format.filesize || format.filesize_approx) /
							1000000
						).toFixed(2);
					} else {
						size = i18n.__("Unknown size");
					}
					const element =
						"<option value='" +
						(format.format_id + "|" + format.ext) +
						"'>" +
						(i18n.__(format.format_note) ||
							format.resolution ||
							i18n.__("Unknown quality")) +
						"  |  " +
						format.ext +
						"  |  " +
						size +
						" " +
						i18n.__("MB") +
						"</option>";
					getId("videoFormatSelect").innerHTML += element;
				}

				// When there is no audio
				if (audioIsPresent === false) {
					getId("audioPresent").style.display = "none";
				} else {
					getId("audioPresent").style.display = "block";
				}
			}
		} else {
			getId("loadingWrapper").style.display = "none";
			getId("incorrectMsg").textContent = i18n.__(
				"Some error has occured. Check your network and use correct URL"
			);
		}
	});
}

// Video download event
getId("videoDownload").addEventListener("click", (event) => {
	getId("hidden").style.display = "none";
	download("video");
});

// Audio download event
getId("audioDownload").addEventListener("click", (event) => {
	getId("hidden").style.display = "none";
	download("audio");
});

getId("extractBtn").addEventListener("click", () => {
	extractFormat = getId("extractSelection").value;
	getId("hidden").style.display = "none";
	download("extract");
});

// Restore previous uncompleted downloads

// function restorePrevious() {
// 	if (!localStorage.getItem("itemList")) return;
// 	const items = JSON.parse(localStorage.getItem("itemList"));
// 	if (items) {
// 		console.log(items);
// 		items.forEach((item) => {
// 			const newItem = `
// 			<div class="item" id="${item.id}">
// 			<img src="../assets/images/close.png" onClick="fadeItem('${
// 				item.id
// 			}')" class="itemClose"}" id="${item.id + ".close"}">
// 			<img src="${item.thumbnail}" alt="thumbnail" class="itemIcon">

// 			<div class="itemBody">
// 				<div class="itemTitle">${item.title}</div>
// 				<div class="itemType">${item.type}</div>
// 				<input disabled type="range" value="0" class="hiddenVideoProgress" id="${
// 					item.id + "vid"
// 				}"></input>
// 				<input disabled type="range" value="0" class="hiddenAudioProgress" id="${
// 					item.id + "aud"
// 				}"></input>
// 				<div id="${item.id + "prog"}" class="itemProgress">Progress: ${
// 				item.progress
// 			}%</div>
// 				<button class="resumeBtn">Resume</button>
// 			</div>
// 		</div>
// 		`;
// 			getId("list").innerHTML += newItem;
// 		});
// 	}
// }

// restorePrevious()

// Time formatting

function timeFormat(duration) {
	// Hours, minutes and seconds
	var hrs = ~~(duration / 3600);
	var mins = ~~((duration % 3600) / 60);
	var secs = ~~duration % 60;
	// Ouput like "1:01" or "4:03:59" or "123:03:59"
	var ret = "";
	if (hrs > 0) {
		ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
	}
	ret += "" + mins + ":" + (secs < 10 ? "0" : "");
	ret += "" + secs;
	return ret;
}

// Manage advanced options, needs to be called

function manageAdvanced(duration) {
	let startTime = getId("startTime").value;
	let endTime = getId("endTime").value;

	if (startTime && !endTime) {
		rangeCmd = `*${startTime}-${timeFormat(duration)}`;
		rangeOption = "--download-sections";
	} else if (!startTime && endTime) {
		rangeCmd = `*0-${endTime}`;
		rangeOption = "--download-sections";
	} else if (startTime && endTime) {
		rangeCmd = `*${startTime}-${endTime}`;
		rangeOption = "--download-sections";
	} else {
		rangeOption = "";
		rangeCmd = "";
	}

	// If subtitles are checked
	if (getId("subChecked").checked){
		subs = "--write-subs"
		subLangs = "--sub-langs all"
	}
	else{
		subs = ""
		subLangs = ""
	}

	// // If autosubs are checked
	// if (getId("autoSubChecked").checked){
	// 	autoSubs = "--write-auto-subs"
	// }
	// else{
	// 	autoSubs = ""
	// }

	console.log("Range option: " + rangeOption);
	console.log("rangeCmd:" + rangeCmd);
}
//////////////////////////////
// Downloading with yt-dlp
//////////////////////////////

function download(type) {
	let willBeSaved = true;
	manageAdvanced(duration);
	const url = getId("url").value;
	let ext;
	let extractExt;

	let format_id;
	const randomId = Math.random().toFixed(10).toString().slice(2);

	if (type === "video") {
		format_id = getId("videoFormatSelect").value.split("|")[0];
		ext = getId("videoFormatSelect").value.split("|")[1];
	} else if (type === "audio") {
		format_id = getId("audioFormatSelect").value.split("|")[0];
		if (getId("audioFormatSelect").value.split("|")[1] === "webm") {
			ext = "opus";
		} else {
			ext = getId("audioFormatSelect").value.split("|")[1];
		}
	}

	localStorage.setItem("itemList", "")
	// let itemList = [];
	// if (localStorage.getItem("itemList")) {
	// 	itemList = JSON.parse(localStorage.getItem("itemList"));
	// }
	const itemInfo = {
		id: randomId,
		format_id: format_id,
		title: title,
		url: url,
		ext: ext,
		type: type,
		thumbnail: thumbnail,
	};
	// itemList.push(itemInfo);
	// localStorage.setItem("itemList", JSON.stringify(itemList));

	const newItem = `
		<div class="item" id="${randomId}">
		<img src="../assets/images/close.png" onClick="fadeItem('${randomId}')" class="itemClose"}" id="${
		randomId + ".close"
	}">
		<img src="${thumbnail}" alt="No thumbnail" class="itemIcon" crossorigin="anonymous">

		<div class="itemBody">
			<div class="itemTitle">${title}</div>
			<div class="itemType">${type === "video" ? "video" : "audio"}</div>
			<div id="${randomId + "prog"}" class="itemProgress"></div>
		</div>
	</div>
	`;
	getId("list").innerHTML += newItem;
	getId("loadingWrapper").style.display = "none";
	getId(randomId + "prog").textContent = i18n.__("Preparing...");

	getId(randomId + ".close").addEventListener("click", () => {
		if (getId(randomId)) {
			fadeItem(randomId);
		}
	});

	let downloadProcess;
	let filename = "";
	// Trying to remove ambiguous characters
	for (let i = 0; i < title.length; i++) {
		const pattern = /^[`~!@#$%^&*:;,<>?/|'"-+=\]\[]$/g;
		let letter = "";
		if (pattern.test(title[i])) {
			letter = "";
		} else {
			if (title[i] == " ") {
				letter = "_";
			} else {
				letter = title[i];
			}
		}
		filename += letter;
	}
	filename = filename + Math.random().toFixed(3).toString().slice(2);

	let audioFormat;

	if (ext === "mp4") {
		audioFormat = "m4a";
	} else {
		audioFormat = "ba";
	}

	let controller = new AbortController();
	console.log(rangeOption + " " + rangeCmd);

	if (type === "video" && onlyvideo) {
		// If video has no sound, audio needs to be downloaded
		console.log("Downloading both video and audio");

		downloadProcess = ytdlp.exec(
			[
				rangeOption,
				rangeCmd,
				"-f",
				`${format_id}+${audioFormat}`,
				"-o",
				`${path.join(downloadDir, filename + `.${ext}`)}`,
				"--ffmpeg-location",
				ffmpeg,
				subs,
				subLangs,
				"--no-playlist",
				url
			],
			{ shell: true, detached: false },
			controller.signal
		);
		}
		else if (type === "extract") {
		if (extractFormat == "alac") {
			extractExt = "m4a";
		} else if (extractFormat == "vorbis") {
			extractExt = "ogg";
		} else {
			extractExt = extractFormat;
		}
		downloadProcess = ytdlp.exec(
			[
				"-x",
				"--audio-format",
				extractFormat,
				"-o",
				`${path.join(downloadDir, filename + `.${extractExt}`)}`,
				"--ffmpeg-location",
				ffmpeg,
				url
			],
			{ shell: true, detached: false },
			controller.signal
		);
	}
	// If downloading only audio or video with audio
	else {
		downloadProcess = ytdlp.exec(
			[
				rangeOption,
				rangeCmd,
				"-f",
				format_id,
				"-o",
				`${path.join(downloadDir, filename + `.${ext}`)}`,
				"--ffmpeg-location",
				ffmpeg,
				subs,
				subLangs,
				"--no-playlist",
				url
			],
			{ shell: true, detached: false },
			controller.signal
		);
	} 

	getId(randomId + ".close").addEventListener("click", () => {
		willBeSaved = false;
		controller.abort()
	});

	downloadProcess
		.on("progress", (progress) => {
			if (progress.percent == 100) {
				getId(randomId + "prog").textContent =
					i18n.__("Processing") + "...";
			} else {
				getId(randomId + "prog").textContent = `${i18n.__(
					"Progress"
				)}: ${progress.percent}%  ${i18n.__("Speed")}: ${
					progress.currentSpeed || 0
				}`;
			}

			// const items = JSON.parse(localStorage.getItem("itemList"));
			// // Clearing item from localstorage
			// for (let item of items) {
			// 	if (item.id == randomId) {
			// 		item.progress = progress.percent;
			// 		break;
			// 	}
			// }
			// localStorage.setItem("itemList", JSON.stringify(items));
		})
		.once("ytDlpEvent", (eventType, eventData) => {
			getId(randomId + "prog").textContent = i18n.__("Downloading...");
		})
		.once("close", () => {
			if (willBeSaved) {
				// const items = JSON.parse(localStorage.getItem("itemList"));
				// // Clearing item from localstorage
				// for (let item of items) {
				// 	if (item.id == randomId) {
				// 		items.splice(items.indexOf(item), 1);
				// 		break;
				// 	}
				// }
				// localStorage.setItem("itemList", JSON.stringify(items));

				// If extration is done
				if (type === "extract") {
					console.log(
						path.join(downloadDir, filename + `.${extractFormat}`)
					);

					afterSave(
						downloadDir,
						filename + `.${extractExt}`,
						randomId + "prog"
					);
				}
				// If download is done
				else {
					console.log(path.join(downloadDir, filename + `.${ext}`));
					afterSave(
						downloadDir,
						filename + `.${ext}`,
						randomId + "prog"
					);
				}
			}
		})
		.once("error", (error) => {
			getId(randomId + "prog").textContent = i18n.__(
				"Some error has occured. Hover to see details"
			);
			getId(randomId + "prog").title = error.message;
			console.log(error.message);
		})

}

// Removing item

function fadeItem(id) {
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			clearInterval(fade);
			if (getId(id)) {
				getId(id).remove();
			}
		} else {
			opacity -= 0.1;
			getId(id).style.opacity = opacity;
			count++;
		}
	}, 50);
}

// After saving video

function afterSave(location, filename, progressId) {
	const notify = new Notification("ytDownloader", {
		body: i18n.__("File saved. Click to Open"),
		icon: "../assets/images/icon.png",
	})

	notify.onclick = () =>{
		showItem(finalLocation, finalFilename);
	}
		
	let finalLocation = location;
	let finalFilename = filename;
	if (os.platform() === "win32") {
		finalLocation = location.split(path.sep).join("\\\\");
		finalFilename = filename.split(path.sep).join("\\\\");
	}
	getId(
		progressId
	).innerHTML = `<b onClick="showItem('${finalLocation}', '${finalFilename}')">${i18n.__(
		"File saved. Click to Open"
	)}</b>`;
}

function showItem(location, filename) {
	shell.showItemInFolder(path.join(location, filename));
}

// Opening windows
function closeMenu() {
	getId("menuIcon").style.transform = "rotate(0deg)";
	menuIsOpen = false;
	let count = 0;
	let opacity = 1;
	const fade = setInterval(() => {
		if (count >= 10) {
			clearInterval(fade);
		} else {
			opacity -= 0.1;
			getId("menu").style.opacity = opacity;
			count++;
		}
	}, 50);
}

getId("preferenceWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-page", __dirname + "/preferences.html");
});

getId("aboutWin").addEventListener("click", () => {
	closeMenu();
	ipcRenderer.send("load-page", __dirname + "/about.html");
});
