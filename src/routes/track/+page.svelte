<script lang="ts">
	import { DrawingUtils, FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import axios from 'axios';
	import { IconLoader2 } from '@tabler/icons-svelte';

	let gesture = '';
	let startX = 0;
	let alreadyTracked = false;
	let swipeRight = 0;
	let swipeLeft = 0;
	let pause = false;
	let global_token: string | null;
	let leftCalled = false;
	let rightCalled = false;
	let pauseCalled = false;
	let playCalled = false;
	let closedFistCalled = false;
	$: mediapipeLoading = true;
	$: currentGesture = '';
	let hash = '';

	onMount(() => {
		hash = window.location.hash;
		// let token = window.localStorage.getItem('token');
		let token = hash.substring(1).split('&')[0].split('=')[1];
		window.localStorage.setItem('token', token);
		const userSignedIn = sessionStorage.getItem('userSignedIn');

		if (userSignedIn === 'false' || userSignedIn === null) {
			goto('/');
		}

		if (token == null && hash) {
			token = hash.substring(1).split('&')[0].split('=')[1];
			window.localStorage.setItem('token', token);
		}

		if (hash) {
			window.location.hash = '';
		}

		global_token = token;

		const cv = async () => {
			let gestureRecognizer: GestureRecognizer;
			let runningMode = 'IMAGE';
			let enableWebcamButton: any;
			let webcamRunning: Boolean = false;
			const videoHeight = '240px';
			const videoWidth = '360px';

			mediapipeLoading = true;
			const vision = await FilesetResolver.forVisionTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
			);
			gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task'
				},
				numHands: 2,
				runningMode: 'VIDEO'
				// minHandDetectionConfidence: 0.3,
				// minHandPresenceConfidence: 0.3,
				// minTrackingConfidence: 0.3
			});
			mediapipeLoading = false;

			const video = document.getElementById('webcam') as HTMLVideoElement;
			const canvasElement = document.getElementById('output-canvas') as HTMLCanvasElement;
			const canvasCtx = canvasElement!.getContext('2d');
			const gestureOutput = document.getElementById('gesture_output');

			enableWebcamButton = document.getElementById('webcamButton');
			enableWebcamButton.addEventListener('click', enableCam);

			function enableCam(event: any) {
				if (!gestureRecognizer) {
					alert('Please wait for gestureRecognizer to load');
					return;
				}

				if (webcamRunning === true) {
					webcamRunning = false;
					enableWebcamButton.innerText = 'Enable Gestures';
					enableWebcamButton.style.backgroundColor = '#1DB954';
					window.location.reload();
				} else {
					console.log('enabling webcam');
					webcamRunning = true;
					enableWebcamButton.innerText = 'Disable Gestures';
					enableWebcamButton.style.backgroundColor = '#ed3737';
				}

				const constraints = {
					video: true
				};

				navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
					video!.srcObject = stream;
					video!.addEventListener('loadeddata', predictWebcam);
				});
			}

			let lastVideoTime = -1;
			let results: any = undefined;
			async function predictWebcam() {
				const webcamElement = document.getElementById('webcam');
				if (runningMode === 'IMAGE') {
					runningMode = 'VIDEO';
					await gestureRecognizer.setOptions({ runningMode: 'VIDEO' });
				}
				let nowInMs = Date.now();
				if (video.currentTime !== lastVideoTime) {
					lastVideoTime = video.currentTime;
					results = gestureRecognizer.recognizeForVideo(video, nowInMs);
				}

				canvasCtx!.save();
				canvasCtx!.clearRect(0, 0, canvasElement.width, canvasElement.height);
				const drawingUtils = new DrawingUtils(canvasCtx as CanvasRenderingContext2D);

				canvasElement.style.height = videoHeight;
				webcamElement!.style.height = videoHeight;
				canvasElement.style.width = videoWidth;
				webcamElement!.style.width = videoWidth;

				if (results.landmarks.length > 0) {
					if (results.landmarks[0][8]) {
						startX = results.landmarks[0][8].x;
					}
					if (startX > 0.6 && gesture === 'Thumb_Up' && !leftCalled) {
						swipeLeft += 1;
						handleSwipeLeft();
						leftCalled = true;
						currentGesture = 'Skipped to Previous!';
					} else if (startX < 0.4 && gesture === 'Thumb_Up' && !rightCalled) {
						swipeRight += 1;
						handleSwipeRight();
						rightCalled = true;
						currentGesture = 'Skipped to Next!';
					} else if (gesture === 'Open_Palm' && !pauseCalled) {
						console.log('should be pausing');
						pauseCalled = true;
						handlePause();
						currentGesture = 'Paused!';
					} else if (gesture === 'Victory' && !playCalled) {
						console.log('should be playing');
						playCalled = true;
						handlePlay();
						currentGesture = 'Resumed!';
					} else if (gesture === 'Closed_Fist' && !closedFistCalled) {
						console.log('should be liking');
						closedFistCalled = true;
						handleLiked();
						currentGesture = 'Liked!';
					}

					if (gesture === 'Open_Palm') {
						pause = true;
					}
					if (gesture === 'Victory') {
						pause = false;
					}

					for (const landmarks of results.landmarks) {
						drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
							color: '#00FF00',
							lineWidth: 5
						});
						drawingUtils.drawLandmarks(landmarks, {
							color: '#FF0000',
							lineWidth: 2
						});
					}
				} else {
					leftCalled = false;
					rightCalled = false;
					pauseCalled = false;
					playCalled = false;
					closedFistCalled = false;
				}
				canvasCtx!.restore();
				if (results.gestures.length > 0) {
					gestureOutput!.style.display = 'block';
					gestureOutput!.style.width = videoWidth;
					const categoryName = results.gestures[0][0].categoryName;
					gesture = categoryName;
					const categoryScore = parseFloat(String(results.gestures[0][0].score * 100)).toFixed(2);
					const handedness = results.handednesses[0][0].displayName;
					gestureOutput!.innerText = `GestureRecognizer: ${categoryName}\n Confidence: ${categoryScore} %\n Handedness: ${handedness}`;
				} else {
					gestureOutput!.style.display = 'none';
				}
				if (webcamRunning === true) {
					window.requestAnimationFrame(predictWebcam);
				}
			}
		};

		cv();
	});

	const refreshMahToken = async () => {
		const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
		const REDIRECT_URI = 'http://localhost:5173/track/';
		const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
		const RESPONSE_TYPE = 'token';
		const SCOPE =
		'user-modify-playback-state user-library-read user-library-modify user-read-recently-played user-read-currently-playing';

		window.location.href = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${encodeURIComponent(
			SCOPE
		)}&response_type=${RESPONSE_TYPE}`;
	}

	const logout = () => {
		window.sessionStorage.removeItem('token');
		goto('/');
	};

	const handleSwipeRight = async () => {
		console.log('global_token', global_token);
		if (!global_token) {
			alert('Spotify api failed to provide a token. Please refresh and try again in 15 secs, cutie <3');
			refreshMahToken();
			return;
		}
		try {
			await axios({
				method: 'post',
				url: 'https://api.spotify.com/v1/me/player/next',
				headers: { Authorization: 'Bearer ' + global_token }
			});
		} catch (error) {
			if(axios.isAxiosError(error) && error.response?.status === 401){
				console.log(error);
				console.log('there is a 401 error here, babe');
				refreshMahToken();
			}
		}
	};

	const handleSwipeLeft = async () => {
		console.log('global_token', global_token);
		if (!global_token) {
			alert('Spotify api failed to provide a token. Please refresh and try again in 15 secs, cutie <3');
			refreshMahToken();
			return;
		}
		try {
			await axios({
				method: 'post',
				url: 'https://api.spotify.com/v1/me/player/previous',
				headers: { Authorization: 'Bearer ' + global_token }
			});
		} catch (error) {
			console.log(error);
				if(axios.isAxiosError(error) && error.response?.status === 401){
					console.log(error);
					console.log('there is a 401 error here, babe');
					refreshMahToken();
				}
		}
	};

	const handlePause = async () => {
		console.log('global_token', global_token);
		if (!global_token) {
			alert('Spotify api failed to provide a token. Please refresh and try again, cutie <3');
			refreshMahToken();
			return;
		}
		try {
			await axios({
				method: 'put',
				url: 'https://api.spotify.com/v1/me/player/pause',
				headers: { Authorization: 'Bearer ' + global_token }
			});
		} catch (error) {
			if(axios.isAxiosError(error) && error.response?.status === 401){
				console.log(error);
				console.log('there is a 401 error here, babe');
				refreshMahToken();
			}
		}
	};

	const handlePlay = async () => {
		console.log('global_token', global_token);
		if (!global_token) {
			alert('Spotify api failed to provide a token. Please refresh and try again in 15 secs, cutie <3');
			refreshMahToken();
			return;
		}
		try {
			await axios({
				method: 'put',
				url: 'https://api.spotify.com/v1/me/player/play',
				headers: { Authorization: 'Bearer ' + global_token }
			});
		} catch (error) {
			console.log(error);
				if(axios.isAxiosError(error) && error.response?.status === 401){
					console.log(error);
					console.log('there is a 401 error here, babe');
					refreshMahToken();
				}
		}
	};

	const get_id_current_song = async () => {
		console.log('global_token', global_token);
		if (!global_token) {
			alert('Spotify api failed to provide a token. Please refresh and try again in 15 secs, cutie <3');
			refreshMahToken();
			return;
		}
		try {
			const res = await axios({
				method: 'get',
				url: 'https://api.spotify.com/v1/me/player/currently-playing',
				headers: { Authorization: 'Bearer ' + global_token }
			});
			let id = res.data.item.id;
			console.log('liked song id: ', id);
			return id;
		} catch (error) {
			if(axios.isAxiosError(error) && error.response?.status === 401){
				console.log(error);
				console.log('there is a 401 error here, babe');
				refreshMahToken();
			}
		}
	};

	const handleLiked = async () => {
		console.log('global_token', global_token);
		if (!global_token) {
			alert('Spotify api failed to provide a token. Please refresh and try again in 15 secs, cutie <3');
			refreshMahToken();
			return;
		}
		try {
			const id = await get_id_current_song();
			await axios({
				method: 'put',
				url: `https://api.spotify.com/v1/me/tracks?ids=${id}`,
				headers: { Authorization: 'Bearer ' + global_token }
			});
		} catch (error) {
			if(axios.isAxiosError(error) && error.response?.status === 401){
				console.log(error);
				console.log('there is a 401 error here, babe');
				refreshMahToken();
			}
		}
	};
</script>

<div class="flex flex-col items-center justify-center text-white w-full h-full gap-16">
	<div class={`${mediapipeLoading ? 'hidden' : 'flex flex-col items-center justify-center gap-8'}`}>
		<div id="video-container" class="relative bg-[#b3b3b3] w-[360px] h-[280px] rounded-md">
			<video id="webcam" autoplay playsinline class="absolute top-5"> </video>
			<canvas class="output-canvas absolute" id="output-canvas" width="360" height="240"> </canvas>
		</div>
		<button
			id="webcamButton"
			class="flex text-black w-fit bg-[#1DB954] hover:opacity-90 transition-opacity font-semibold rounded-lg text-base px-5 py-3 text-center items-center justify-center gap-3"
		>
			<span>Enable Gestures</span>
		</button>
		<p class="font-bold text-[#1db954]">{currentGesture}</p>
		<div class="hidden">
			<p id="gesture_output" class="output"></p>
		</div>
	</div>
	<div
		class={`flex flex-col items-center justify-center w-full ${mediapipeLoading ? 'block' : 'hidden'}`}
	>
		<IconLoader2 class="animate-spin w-16 h-16" />
	</div>
	<div class="flex flex-col items-center justify-center gap-8">
		<div class="flex flex-col items-center gap-4 -mt-8">
			<!-- <h2 class="font-bold text-2xl">Gesture	s</h2> -->

			<table class="text-white rounded-lg shadow-xl">
				<tr>
					<th align="left" scope="row">Skip Forward</th>
					<td align="right">Gig Em' to the right 👍 👉</td>
				</tr>
				<tr>
					<th align="left" scope="row">Go Backward</th>
					<td align="right">Gig Em' to the left 👍 👈</td>
				</tr>
				<tr>
					<th align="left" scope="row">Pause Song</th>
					<td align="right">Open hand ✋</td>
				</tr>
				<tr>
					<th align="left" scope="row">Play Song</th>
					<td align="right">Peace sign ✌️</td>
				</tr>
				<tr>
					<th align="left" scope="row" class="pr-6">Add to liked songs</th>
					<td align="right">Close hand ✊</td>
				</tr>
			</table>
		</div>
	</div>
</div>

<style>
	#webcam {
		transform: scaleX(-1);
	}

	#output-canvas {
		transform: scaleX(-1);
	}

	#video-container {
		background-image: url('/video.svg');
		background-repeat: no-repeat;
		background-position: center;
		background-size: 20%;
	}

	#cv-container {
		background-image: url('/line.svg');
		background-repeat: no-repeat;
		background-position: center;
		background-size: 20%;
	}

	th {
		padding-top: 10px;
		padding-bottom: 10px;
		padding-right: 12px;
	}

	td {
		padding: 10px;
		font-style: italic;
	}
</style>
