<script lang="ts">
	import { DrawingUtils, FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import axios from 'axios';

	let gesture = '';
	let startX = 0;
	let alreadyTracked = false;
	let swipeRight = 0;
	let swipeLeft = 0;
	let global_token: string | null;

	onMount(() => {
		const hash = window.location.hash;
		const token = window.localStorage.getItem('token');
		const userSignedIn = sessionStorage.getItem('userSignedIn') === 'true';

		if (!userSignedIn) {
			goto('/');
		}

		if (!token && hash) {
			const token = hash.substring(1).split('&')[0].split('=')[1];
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
			const videoHeight = '360px';
			const videoWidth = '480px';

			const vision = await FilesetResolver.forVisionTasks(
				// path/to/wasm/root
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
			);
			gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task'
				},
				numHands: 2,
				runningMode: 'VIDEO',
				minHandDetectionConfidence: 0.3,
				minHandPresenceConfidence: 0.3,
				minTrackingConfidence: 0.3
			});

			const video = document.getElementById('webcam') as HTMLVideoElement;
			const canvasElement = document.getElementById('output_canvas') as HTMLCanvasElement;
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
					enableWebcamButton.innerText = 'ENABLE PREDICTIONS';
				} else {
					webcamRunning = true;
					enableWebcamButton.innerText = 'DISABLE PREDICTIONS';
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
					if (results.landmarks[0][8] && !alreadyTracked) {
						startX = results.landmarks[0][8].x;
						alreadyTracked = true;
					}

					if (startX - results.landmarks[0][8].x < -0.3) {
						swipeLeft = 1;
						alreadyTracked = false;
					}
					if (startX - results.landmarks[0][8].x > 0.3) {
						swipeRight = 1;
						// swipeRight += 1;
						handleSwipeRight();
						alreadyTracked = false;
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

	const logout = () => {
		window.sessionStorage.removeItem('token');
		goto('/');
	};

	const handleSwipeRight = async () => {
		
		console.log('global_token', global_token);
		if (!global_token) {
			alert('Spotify api failed to provide a token. Please refresh and try again, cutie <3');
			return;
		}
		try {
			await axios({
				method: 'post',
				url: 'https://api.spotify.com/v1/me/player/next',
				headers: { Authorization: 'Bearer ' + global_token }
			});
		} catch (error) {
			console.log(error);
			alert(
				'The Spotify API is currently having problems with getting your request for some reason. Please try again in 15 seconds, cutie <3'
			);
		}
	};
</script>

<button id="webcamButton">
	<span>ENABLE WEBCAM</span>
</button>
<video id="webcam" autoplay playsinline class=""></video>
<canvas class="output_canvas hidden" id="output_canvas" width="1280" height="720"></canvas>
<p id="gesture_output" class="output"></p>
<p>swipe right: {swipeRight}</p>
<p>swipe left: {swipeLeft}</p>

<style>
	#webcam {
		transform: scaleX(-1);
	}
</style>
